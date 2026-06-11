import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, incrementFailCount } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/getClientIp";
import { timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";

// Comparação em tempo constante — evita brute-force assistido por timing.
function codesMatch(a: string, b: string): boolean {
  const max = Math.max(a.length, b.length, 1);
  return a.length === b.length &&
    timingSafeEqual(Buffer.from(a.padEnd(max, "\0")), Buffer.from(b.padEnd(max, "\0")));
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);

    // Rate limit por IP — trava brute-force do código de 6 dígitos.
    if (!await checkRateLimit("reset_password_ip", ip, 10, 15 * 60_000)) {
      return NextResponse.json(
        { error: "Demasiadas tentativas. Aguarda 15 minutos.", rateLimited: true },
        { status: 429 }
      );
    }

    const { email, code, password } = await req.json();

    if (!email || !code || !password) {
      return NextResponse.json({ error: "Dados em falta" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "A senha deve ter pelo menos 6 caracteres" }, { status: 400 });
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    // Rate limit por email — mesmo rodando IPs, há um tecto por conta-alvo.
    if (!await checkRateLimit("reset_password_email", normalizedEmail, 10, 15 * 60_000)) {
      return NextResponse.json(
        { error: "Demasiadas tentativas. Aguarda 15 minutos.", rateLimited: true },
        { status: 429 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    const codeOk =
      !!user &&
      typeof user.pwdOtpCode === "string" &&
      codesMatch(user.pwdOtpCode, String(code)) &&
      !!user.pwdOtpExpires &&
      user.pwdOtpExpires >= new Date();

    if (!codeOk) {
      // Após 5 falhas, invalida o código activo — força pedir um novo.
      if (user) {
        const fails = await incrementFailCount(`pwd_reset:${user.id}`, 30 * 60_000);
        if (fails >= 5 && user.pwdOtpCode) {
          await prisma.user.update({
            where: { id: user.id },
            data:  { pwdOtpCode: null, pwdOtpExpires: null },
          }).catch(() => {});
        }
      }
      return NextResponse.json({ error: "Código inválido ou expirado" }, { status: 400 });
    }

    // Hash da nova senha
    const hashedPassword = await bcrypt.hash(password, 12);

    // Atualizar senha e limpar OTP
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        pwdOtpCode: null,
        pwdOtpExpires: null,
      },
    });

    return NextResponse.json({ success: true, message: "Senha alterada com sucesso." });
  } catch (error) {
    console.error("[reset-password] Error:", error);
    return NextResponse.json({ error: "Erro interno ao processar alteração" }, { status: 500 });
  }
}
