import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPasswordOtpEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/getClientIp";
import { randomInt } from "crypto";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    // 3 pedidos por IP a cada 15 minutos
    if (!await checkRateLimit("forgot_password", ip, 3, 15 * 60_000)) {
      return NextResponse.json(
        { error: "Demasiados pedidos. Aguarda 15 minutos antes de tentar novamente.", rateLimited: true },
        { status: 429 }
      );
    }

    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email é obrigatório" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true },
    });

    if (!user) {
      // Resposta idêntica ao caso de sucesso — não revelar se o email existe
      return NextResponse.json({ success: true, message: "Se o email estiver registado, receberás um código em breve." });
    }

    // Gerar código de 6 dígitos criptograficamente seguro
    const code = randomInt(100000, 1000000).toString();
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

    return NextResponse.json({ success: true, message: "Se o email estiver registado, receberás um código em breve." });
  } catch (error) {
    console.error("[forgot-password] Error:", error);
    return NextResponse.json({ error: "Erro interno ao processar pedido" }, { status: 500 });
  }
}
