import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  // 5 tentativas por utilizador a cada 15 minutos — protecção contra brute force na senha
  if (!await checkRateLimit("2fa-disable", session.user.id, 5, 15 * 60_000)) {
    return NextResponse.json({ error: "Demasiadas tentativas. Aguarda 15 minutos." }, { status: 429 });
  }

  const { password } = await req.json();
  if (!password) return NextResponse.json({ error: "Senha obrigatória" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: "Utilizador não encontrado" }, { status: 404 });
  if (!user.twoFactorEnabled) return NextResponse.json({ error: "2FA não está activo" }, { status: 400 });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return NextResponse.json({ error: "Senha incorreta" }, { status: 400 });

  await prisma.user.update({
    where: { id: user.id },
    data:  {
      twoFactorEnabled: false,
      twoFactorMethod:  null,
      twoFactorSecret:  null,
      twoFaCode:        null,
      twoFaExpires:     null,
    },
  });

  prisma.accessLog.create({ data: { userId: user.id, email: user.email, action: "2fa_disabled", ip: req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for") ?? "unknown" } }).catch(() => {});

  return NextResponse.json({ success: true });
}
