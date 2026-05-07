import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const transactions = await prisma.transaction.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json(transactions);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { type, amount, method, reference, otp } = await req.json();

  if (!["deposit", "withdrawal"].includes(type)) {
    return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
  }
  if (!amount || amount < 1000) {
    return NextResponse.json({ error: "Valor mínimo: 1.000 Kz" }, { status: 400 });
  }
  if (!otp) {
    return NextResponse.json({ error: "Código OTP obrigatório" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: "Utilizador não encontrado" }, { status: 404 });

  if (
    !user.verifyCode ||
    user.verifyCode !== String(otp) ||
    !user.verifyExpires ||
    user.verifyExpires < new Date()
  ) {
    return NextResponse.json({ error: "Código OTP inválido ou expirado" }, { status: 400 });
  }

  // Invalidar o OTP após uso
  await prisma.user.update({
    where: { id: user.id },
    data:  { verifyCode: null, verifyExpires: null },
  });

  const tx = await prisma.transaction.create({
    data: {
      userId: session.user.id,
      type,
      amount,
      method,
      reference,
      status: "pending",
    },
  });

  return NextResponse.json(tx, { status: 201 });
}
