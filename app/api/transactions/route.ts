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

  const { type, amount, method, reference } = await req.json();

  if (!["deposit", "withdrawal"].includes(type)) {
    return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
  }
  if (!amount || amount < 1000) {
    return NextResponse.json({ error: "Valor mínimo: 1.000 Kz" }, { status: 400 });
  }

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
