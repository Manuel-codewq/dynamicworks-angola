import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/copy/follow — seguir ou actualizar amount
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { traderId, amount } = await req.json().catch(() => ({}));
  if (!traderId) return NextResponse.json({ error: "traderId obrigatório" }, { status: 400 });

  const amountNum = Number(amount);
  if (!amountNum || amountNum < 1000 || amountNum > 500000) {
    return NextResponse.json({ error: "Valor entre 1.000 e 500.000 Kz" }, { status: 400 });
  }

  const trader = await prisma.copyTrader.findUnique({ where: { id: traderId } });
  if (!trader || trader.status !== "approved") {
    return NextResponse.json({ error: "Expert não encontrado" }, { status: 404 });
  }
  if (trader.userId === session.user.id) {
    return NextResponse.json({ error: "Não podes seguir-te a ti próprio" }, { status: 400 });
  }

  const follow = await prisma.copyFollow.upsert({
    where: { followerId_traderId: { followerId: session.user.id, traderId } },
    create: { followerId: session.user.id, traderId, amount: amountNum, active: true },
    update: { amount: amountNum, active: true },
  });

  // Actualizar contagem de seguidores
  await prisma.copyTrader.update({
    where: { id: traderId },
    data: { totalFollowers: await prisma.copyFollow.count({ where: { traderId, active: true } }) },
  });

  return NextResponse.json({ follow });
}

// DELETE /api/copy/follow?traderId=xxx — parar de seguir
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const traderId = new URL(req.url).searchParams.get("traderId");
  if (!traderId) return NextResponse.json({ error: "traderId obrigatório" }, { status: 400 });

  await prisma.copyFollow.updateMany({
    where: { followerId: session.user.id, traderId },
    data: { active: false },
  });

  const trader = await prisma.copyTrader.findUnique({ where: { id: traderId } });
  if (trader) {
    await prisma.copyTrader.update({
      where: { id: traderId },
      data: { totalFollowers: await prisma.copyFollow.count({ where: { traderId, active: true } }) },
    });
  }

  return NextResponse.json({ ok: true });
}
