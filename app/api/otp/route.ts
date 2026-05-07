import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendTransactionOtpEmail } from "@/lib/email";

// POST /api/otp — gera e envia OTP para depósito/levantamento
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { type, amount } = await req.json();
  if (!["deposit", "withdrawal"].includes(type)) {
    return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: "Utilizador não encontrado" }, { status: 404 });

  const code    = String(Math.floor(100000 + Math.random() * 900000));
  const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

  await prisma.user.update({
    where: { id: user.id },
    data:  { verifyCode: code, verifyExpires: expires },
  });

  await sendTransactionOtpEmail(user.email, user.name, code, type, amount);

  return NextResponse.json({ sent: true });
}
