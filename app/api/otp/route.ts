import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendTransactionOtpEmail } from "@/lib/email";
import { randomInt } from "crypto";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  // 3 OTPs por userId a cada 10 minutos
  if (!await checkRateLimit("otp", session.user.id, 3, 10 * 60_000)) {
    return NextResponse.json(
      { error: "Demasiados pedidos de OTP. Aguarde 10 minutos." },
      { status: 429 }
    );
  }

  const { type, amount } = await req.json();
  if (!["deposit", "withdrawal"].includes(type)) {
    return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: "Utilizador não encontrado" }, { status: 404 });

  // Campo separado (otpCode) — não partilha com verifyCode de email
  const code    = String(randomInt(100000, 1000000));
  const expires = new Date(Date.now() + 10 * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data:  { otpCode: code, otpExpires: expires },
  });

  await sendTransactionOtpEmail(user.email, user.name, code, type, amount);

  return NextResponse.json({ sent: true });
}
