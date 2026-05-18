import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/getClientIp";
import { checkRateLimit, incrementFailCount, getFailCount } from "@/lib/rateLimit";
import { send2FAEmail } from "@/lib/email";

const MAX_FAIL = 5;
const FAIL_WINDOW_MS = 30 * 60_000; // 30 minutos

const DUMMY_HASH = "$2a$12$CwTycUXWue0Thq9StjUM0uJ8.GJ6JfQ6vBz0Y1pX9P5kQZ4Zk9w0a";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    const ip = getClientIp(req);
    const normalizedEmail = (email as string).toLowerCase().trim();

    // Bloqueio por falhas acumuladas (independente do rate limit por IP)
    const failCount = await getFailCount(`login:${normalizedEmail}`);
    if (failCount >= MAX_FAIL) {
      return NextResponse.json(
        { error: "Conta temporariamente bloqueada por excesso de tentativas. Tenta novamente em 30 minutos ou recupera a senha." },
        { status: 429 }
      );
    }

    // Rate limit por IP — protege contra brute force em massa
    if (!await checkRateLimit("login_ip", ip, 60, 15 * 60_000)) {
      return NextResponse.json({ error: "Demasiadas tentativas a partir deste endereço. Aguarda 15 minutos." }, { status: 429 });
    }

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    // Comparar com hash dummy se utilizador não existe (timing attack protection)
    const { default: bcrypt } = await import("bcryptjs");
    const hashToCompare = user?.password ?? DUMMY_HASH;
    const validPassword  = await bcrypt.compare(password as string, hashToCompare);

    if (!user || !validPassword || user.status === "blocked" || !user.emailVerified) {
      // Incrementar contador de falhas por email (só quando o email existe, para não revelar contas)
      if (user) await incrementFailCount(`login:${normalizedEmail}`, FAIL_WINDOW_MS);
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
