import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPasswordOtpEmail } from "@/lib/email";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email é obrigatório" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Não encontrámos nenhuma conta com esse email. Verifica se escreveste bem ou regista-te." },
        { status: 404 }
      );
    }

    // Gerar código de 6 dígitos
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutos

    await prisma.user.update({
      where: { id: user.id },
      data: {
        pwdOtpCode: code,
        pwdOtpExpires: expires,
      },
    });

    // Enviar email — lança erro se não for possível (ex: RESEND_API_KEY em falta)
    if (!process.env.RESEND_API_KEY) {
      console.error("[forgot-password] RESEND_API_KEY não configurada — impossível enviar email");
      return NextResponse.json(
        { error: "Serviço de email não configurado. Contacta o suporte: +244 921 825 299." },
        { status: 503 }
      );
    }

    await sendPasswordOtpEmail(user.email, user.name, code);

    return NextResponse.json({ success: true, message: "Código enviado com sucesso." });
  } catch (error) {
    console.error("[forgot-password] Error:", error);
    return NextResponse.json({ error: "Erro interno ao processar pedido" }, { status: 500 });
  }
}
