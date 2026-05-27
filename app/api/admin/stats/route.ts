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

  // Use groupBy/aggregate instead of findMany to avoid loading millions of rows
  const [
    totalUsers,
    balanceAgg,
    demoBalanceAgg,
    todayTradesReal,
    todayTradesDemo,
    allTimeStats,
    todayStats,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.aggregate({ _sum: { balance: true } }),
    prisma.user.aggregate({ _sum: { demoBalance: true } }),
    prisma.trade.count({ where: { createdAt: { gte: today }, isDemo: false } }),
    prisma.trade.count({ where: { createdAt: { gte: today }, isDemo: true  } }),
    // All-time win counts via groupBy — O(1) query regardless of row count
    prisma.trade.groupBy({
      by: ["isDemo", "result"],
      where: { status: "closed" },
      _count: { id: true },
    }),
    // Today's profit per account type
    prisma.trade.groupBy({
      by: ["isDemo", "result"],
      where: { status: "closed", closedAt: { gte: today } },
      _sum:   { amount: true },
      _count: { id: true },
    }),
  ]);

  function extractStats(
    allRows:   { isDemo: boolean; result: string | null; _count: { id: number } }[],
    todayRows: { isDemo: boolean; result: string | null; _sum: { amount: number | null }; _count: { id: number } }[],
    todayTradesCount: number,
    isDemo: boolean,
  ) {
    const myAll   = allRows.filter(r => r.isDemo === isDemo);
    const myToday = todayRows.filter(r => r.isDemo === isDemo);

    const totalClosed = myAll.reduce((s, r) => s + r._count.id, 0);
    const totalWins   = myAll.filter(r => r.result === "win").reduce((s, r) => s + r._count.id, 0);
    const winRate     = totalClosed > 0 ? Math.round((totalWins / totalClosed) * 100) : 0;

    // Profit = sum of amounts where result=loss (broker keeps the bet)
    const platformProfit = myToday
      .filter(r => r.result === "loss")
      .reduce((s, r) => s + (r._sum.amount ?? 0), 0);

    return { todayTradesCount, platformProfit: Math.round(platformProfit), winRate, totalTrades: totalClosed };
  }

  const real = extractStats(allTimeStats, todayStats, todayTradesReal, false);
  const demo = extractStats(allTimeStats, todayStats, todayTradesDemo, true);

  return NextResponse.json({
    totalUsers,
    totalBalance:         balanceAgg._sum.balance      ?? 0,
    todayTradesCount:     real.todayTradesCount,
    platformProfit:       real.platformProfit,
    winRate:              real.winRate,
    totalTrades:          real.totalTrades,
    totalDemoBalance:     demoBalanceAgg._sum.demoBalance ?? 0,
    demoTodayTradesCount: demo.todayTradesCount,
    demoPlatformProfit:   demo.platformProfit,
    demoWinRate:          demo.winRate,
    demoTotalTrades:      demo.totalTrades,
  });
}
