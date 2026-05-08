import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email";
import { randomInt } from "crypto";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email em falta" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 3 reenvios por email a cada 15 minutos
    if (!checkRateLimit("resend-verify", normalizedEmail, 3, 15 * 60_000)) {
      return NextResponse.json(
        { error: "Demasiados pedidos. Aguarda 15 minutos antes de pedir novo código." },
        { status: 429 }
      );
    }

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      // Resposta genérica — não revelar se o email existe ou não
      return NextResponse.json({ success: true });
    }
    if (user.emailVerified) {
      return NextResponse.json({ success: true, alreadyVerified: true });
    }

    const code = String(randomInt(100000, 1000000));
    const verifyExpires = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { verifyCode: code, verifyExpires },
    });

    try {
      await sendVerificationEmail(user.email, user.name, code);
    } catch (err) {
      console.error("[email] Falha ao reenviar verificação:", err);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
