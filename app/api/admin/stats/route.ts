import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const [
    totalUsers,
    balanceAgg,
    todayTradesCount,
    todayClosedTrades,
    allClosedTrades,
  ] = await Promise.all([
    prisma.user.count(),
    // Só soma saldos de contas reais
    prisma.user.aggregate({ _sum: { balance: true } }),
    // Só conta trades reais (isDemo: false)
    prisma.trade.count({ where: { createdAt: { gte: today }, isDemo: false } }),
    // Só trades reais fechados hoje
    prisma.trade.findMany({
      where: { status: "closed", closedAt: { gte: today }, isDemo: false },
      select: { result: true, amount: true, profit: true },
    }),
    // Só trades reais fechados (para taxa de vitória)
    prisma.trade.findMany({
      where: { status: "closed", isDemo: false },
      select: { result: true },
    }),
  ]);

  const totalBalance   = balanceAgg._sum.balance ?? 0;
  const platformProfit = todayClosedTrades
    .filter(t => t.result === "loss")
    .reduce((s, t) => s + t.amount, 0);
  const wins    = allClosedTrades.filter(t => t.result === "win").length;
  const winRate = allClosedTrades.length > 0
    ? Math.round((wins / allClosedTrades.length) * 100)
    : 0;

  return NextResponse.json({
    totalUsers,
    totalBalance,
    todayTradesCount,
    platformProfit,
    winRate,
    totalTrades: allClosedTrades.length,
  });
}
