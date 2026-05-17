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
    demoBalanceAgg,
    todayTradesReal,
    todayTradesDemo,
    todayClosedReal,
    todayClosedDemo,
    allClosedReal,
    allClosedDemo,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.aggregate({ _sum: { balance: true } }),
    prisma.user.aggregate({ _sum: { demoBalance: true } }),
    prisma.trade.count({ where: { createdAt: { gte: today }, isDemo: false } }),
    prisma.trade.count({ where: { createdAt: { gte: today }, isDemo: true  } }),
    prisma.trade.findMany({ where: { status: "closed", closedAt: { gte: today }, isDemo: false }, select: { result: true, amount: true } }) as Promise<{ result: string; amount: number }[]>,
    prisma.trade.findMany({ where: { status: "closed", closedAt: { gte: today }, isDemo: true  }, select: { result: true, amount: true } }) as Promise<{ result: string; amount: number }[]>,
    prisma.trade.findMany({ where: { status: "closed", isDemo: false }, select: { result: true } }) as Promise<{ result: string }[]>,
    prisma.trade.findMany({ where: { status: "closed", isDemo: true  }, select: { result: true } }) as Promise<{ result: string }[]>,
  ]);

  function calcStats(closed: { result: string }[], todayClosed: { result: string; amount: number }[], todayCount: number, total: number) {
    const wins        = closed.filter(t => t.result === "win").length;
    const winRate     = closed.length > 0 ? Math.round((wins / closed.length) * 100) : 0;
    const profit      = todayClosed.filter(t => t.result === "loss").reduce((s, t) => s + t.amount, 0);
    return { todayTradesCount: todayCount, platformProfit: profit, winRate, totalTrades: closed.length };
  }

  const real = calcStats(allClosedReal, todayClosedReal, todayTradesReal, 0);
  const demo = calcStats(allClosedDemo, todayClosedDemo, todayTradesDemo, 0);

  return NextResponse.json({
    totalUsers,
    // Real
    totalBalance:        balanceAgg._sum.balance      ?? 0,
    todayTradesCount:    real.todayTradesCount,
    platformProfit:      real.platformProfit,
    winRate:             real.winRate,
    totalTrades:         real.totalTrades,
    // Demo
    totalDemoBalance:    demoBalanceAgg._sum.demoBalance ?? 0,
    demoTodayTradesCount: demo.todayTradesCount,
    demoPlatformProfit:  demo.platformProfit,
    demoWinRate:         demo.winRate,
    demoTotalTrades:     demo.totalTrades,
  });
}
