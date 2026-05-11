import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  try {
    const { email, code } = await req.json();
    if (!email || !code) {
      return NextResponse.json({ error: "Dados em falta" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 5 tentativas por email a cada 15 minutos — protecção contra brute force ao código
    if (!await checkRateLimit("verify-email", normalizedEmail, 5, 15 * 60_000)) {
      return NextResponse.json(
        { error: "Demasiadas tentativas. Aguarda 15 minutos ou solicita um novo código." },
        { status: 429 }
      );
    }

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      // Mensagem genérica para não revelar se o email está registado
      return NextResponse.json({ error: "Código incorrecto" }, { status: 400 });
    }
    if (user.emailVerified) {
      return NextResponse.json({ success: true, alreadyVerified: true });
    }
    if (!user.verifyCode || !user.verifyExpires) {
      return NextResponse.json({ error: "Código inválido" }, { status: 400 });
    }
    if (new Date() > user.verifyExpires) {
      return NextResponse.json({ error: "Código expirado. Solicita um novo código." }, { status: 400 });
    }
    if (user.verifyCode !== code.trim()) {
      return NextResponse.json({ error: "Código incorrecto" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, verifyCode: null, verifyExpires: null },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
