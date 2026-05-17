import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyTurnstile } from "@/lib/verifyTurnstile";
import { getClientIp } from "@/lib/getClientIp";
import { checkRateLimit } from "@/lib/rateLimit";
import { send2FAEmail } from "@/lib/email";

const DUMMY_HASH = "$2a$12$CwTycUXWue0Thq9StjUM0uJ8.GJ6JfQ6vBz0Y1pX9P5kQZ4Zk9w0a";

export async function POST(req: NextRequest) {
  try {
    const { email, password, turnstileToken } = await req.json();
    const ip = getClientIp(req);

    // Turnstile
    const turnstileOk = await verifyTurnstile(turnstileToken ?? "", ip);
    if (!turnstileOk) {
      return NextResponse.json({ error: "Verificação de segurança falhou." }, { status: 400 });
    }

    // Rate limit
    if (!await checkRateLimit("login_ip", ip, 30, 15 * 60_000)) {
      return NextResponse.json({ error: "Demasiadas tentativas. Aguarda 15 minutos." }, { status: 429 });
    }

    const normalizedEmail = (email as string).toLowerCase().trim();

    if (!await checkRateLimit("login_email", normalizedEmail, 10, 15 * 60_000)) {
      return NextResponse.json({ error: "Demasiadas tentativas. Aguarda 15 minutos." }, { status: 429 });
    }

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    // Comparar com hash dummy se utilizador não existe (timing attack protection)
    const { default: bcrypt } = await import("bcryptjs");
    const hashToCompare = user?.password ?? DUMMY_HASH;
    const validPassword  = await bcrypt.compare(password as string, hashToCompare);

    if (!user || !validPassword || user.status === "blocked" || !user.emailVerified) {
      return NextResponse.json({ valid: false }, { status: 401 });
    }

    // Sem 2FA — login directo
    if (!user.twoFactorEnabled) {
      return NextResponse.json({ valid: true, needs2fa: false });
    }

    // Com 2FA por email — enviar código
    if (user.twoFactorMethod === "email") {
      const hasValid = user.twoFaCode && user.twoFaExpires && user.twoFaExpires > new Date();
      if (!hasValid) {
        const arr  = new Uint32Array(1);
        crypto.getRandomValues(arr);
        const code    = String(100000 + (arr[0] % 900000));
        const expires = new Date(Date.now() + 10 * 60_000);
        await prisma.user.update({
          where: { id: user.id },
          data:  { twoFaCode: code, twoFaExpires: expires },
        });
        send2FAEmail(user.email, user.name, code).catch(() => {});
      }
      return NextResponse.json({ valid: true, needs2fa: true, method: "email" });
    }

    // TOTP
    return NextResponse.json({ valid: true, needs2fa: true, method: "totp" });
  } catch {
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
