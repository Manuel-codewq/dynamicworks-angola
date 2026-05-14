import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const { email, code, password } = await req.json();

    if (!email || !code || !password) {
      return NextResponse.json({ error: "Dados em falta" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "A senha deve ter pelo menos 6 caracteres" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || user.pwdOtpCode !== code) {
      return NextResponse.json({ error: "Código inválido" }, { status: 400 });
    }

    if (user.pwdOtpExpires && user.pwdOtpExpires < new Date()) {
      return NextResponse.json({ error: "O código expirou" }, { status: 400 });
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
