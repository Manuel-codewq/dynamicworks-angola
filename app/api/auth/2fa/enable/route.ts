import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyTotpToken } from "@/lib/totp";
import { randomInt } from "crypto";
import { send2FAEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  // 5 tentativas por utilizador a cada 15 minutos
  if (!await checkRateLimit("2fa-enable", session.user.id, 5, 15 * 60_000)) {
    return NextResponse.json({ error: "Demasiadas tentativas. Aguarda 15 minutos." }, { status: 429 });
  }

  const { method, token } = await req.json();

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: "Utilizador não encontrado" }, { status: 404 });
  // Permite reactivar mesmo que já esteja activo (ex: troca de método)

  if (method === "totp") {
    if (!user.twoFactorSecret) {
      return NextResponse.json({ error: "Faz o setup primeiro" }, { status: 400 });
    }
    if (!(await verifyTotpToken(token, user.twoFactorSecret))) {
      return NextResponse.json({ error: "Código inválido" }, { status: 400 });
    }
    await prisma.user.update({
      where: { id: user.id },
      data:  { twoFactorEnabled: true, twoFactorMethod: "totp" },
    });
    prisma.accessLog.create({ data: { userId: user.id, email: user.email, action: "2fa_enabled", ip: req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for") ?? "unknown" } }).catch(() => {});
    return NextResponse.json({ success: true });
  }

  if (method === "email") {
    if (!token) {
      // Enviar código de confirmação
      const code    = String(randomInt(100000, 1000000));
      const expires = new Date(Date.now() + 10 * 60_000);
      await prisma.user.update({
        where: { id: user.id },
        data:  { twoFaCode: code, twoFaExpires: expires, twoFactorMethod: "email" },
      });
      await send2FAEmail(user.email, user.name, code);
      return NextResponse.json({ codeSent: true });
    }

    // Verificar código
    const valid =
      user.twoFaCode === token &&
      user.twoFaExpires instanceof Date &&
      user.twoFaExpires > new Date();

    if (!valid) return NextResponse.json({ error: "Código inválido ou expirado" }, { status: 400 });

    await prisma.user.update({
      where: { id: user.id },
      data:  {
        twoFactorEnabled: true,
        twoFactorMethod:  "email",
        twoFaCode:        null,
        twoFaExpires:     null,
      },
    });
    prisma.accessLog.create({ data: { userId: user.id, email: user.email, action: "2fa_enabled", ip: req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for") ?? "unknown" } }).catch(() => {});
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Método inválido" }, { status: 400 });
}
