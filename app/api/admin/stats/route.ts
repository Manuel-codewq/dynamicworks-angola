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

  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

  const [
    totalUsers,
    balanceAgg,
    demoBalanceAgg,
    todayTradesReal,
    todayTradesDemo,
    allTimeStats,
    todayStats,
    newUsersToday,
    pendingDeposits,
    pendingWithdrawals,
    todayDepositsAgg,
    todayWithdrawalsAgg,
    last7DaysTrades,
    depositors,
    realTraders,
    kycApproved,
    withRealBalance,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.aggregate({ _sum: { balance: true } }),
    prisma.user.aggregate({ _sum: { demoBalance: true } }),
    prisma.trade.count({ where: { createdAt: { gte: today }, isDemo: false } }),
    prisma.trade.count({ where: { createdAt: { gte: today }, isDemo: true  } }),
    prisma.trade.groupBy({
      by: ["isDemo", "result"],
      where: { status: "closed" },
      _count: { id: true },
    }),
    prisma.trade.groupBy({
      by: ["isDemo", "result"],
      where: { status: "closed", closedAt: { gte: today } },
      _sum:   { amount: true },
      _count: { id: true },
    }),
    prisma.user.count({ where: { createdAt: { gte: today } } }),
    prisma.transaction.count({ where: { type: "deposit",    status: "pending" } }),
    prisma.transaction.count({ where: { type: "withdrawal", status: "pending" } }),
    prisma.transaction.aggregate({
      where: { type: "deposit",    status: "completed", createdAt: { gte: today } },
      _sum: { amount: true }, _count: { id: true },
    }),
    prisma.transaction.aggregate({
      where: { type: "withdrawal", status: "completed", createdAt: { gte: today } },
      _sum: { amount: true }, _count: { id: true },
    }),
    // P&L últimos 7 dias — buscar campos necessários para agrupar por dia no servidor
    prisma.trade.findMany({
      where: { status: "closed", isDemo: false, closedAt: { gte: sevenDaysAgo } },
      select: { result: true, amount: true, closedAt: true },
    }),

    // ── Contas reais ────────────────────────────────────────────────────
    // "Conta real" = tem saldo real neste momento (ver withRealBalance mais
    // abaixo). Os outros números ficam ao lado para dar contexto: quem já
    // depositou alguma vez, quem já operou a sério e quem tem KYC aprovado.
    // `distinct` porque interessa a pessoa, não o número de depósitos.
    prisma.transaction.findMany({
      where: { type: "deposit", status: "completed" },
      select: { userId: true }, distinct: ["userId"],
    }),
    prisma.trade.findMany({
      where: { isDemo: false },
      select: { userId: true }, distinct: ["userId"],
    }),
    prisma.user.count({ where: { kycStatus: "approved" } }),
    prisma.user.count({ where: { balance: { gt: 0 } } }),
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

    const platformProfit = myToday
      .filter(r => r.result === "loss")
      .reduce((s, r) => s + (r._sum.amount ?? 0), 0);

    return { todayTradesCount, platformProfit: Math.round(platformProfit), winRate, totalTrades: totalClosed };
  }

  const real = extractStats(allTimeStats, todayStats, todayTradesReal, false);
  const demo = extractStats(allTimeStats, todayStats, todayTradesDemo, true);

  // Construir P&L por dia (últimos 7 dias)
  const pnlMap: Record<string, number> = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(sevenDaysAgo);
    d.setDate(d.getDate() + i);
    pnlMap[d.toISOString().slice(0, 10)] = 0;
  }
  for (const t of last7DaysTrades) {
    if (!t.closedAt) continue;
    const day = new Date(t.closedAt).toISOString().slice(0, 10);
    if (day in pnlMap && t.result === "loss") {
      pnlMap[day] += t.amount;
    }
  }
  const pnlLast7Days = Object.entries(pnlMap).map(([date, profit]) => ({
    date,
    profit: Math.round(profit),
  }));

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
    // Novas métricas
    newUsersToday,
    pendingDeposits,
    pendingWithdrawals,
    todayDepositsAmount:      Math.round(todayDepositsAgg._sum.amount      ?? 0),
    todayDepositsCount:       todayDepositsAgg._count.id,
    todayWithdrawalsAmount:   Math.round(todayWithdrawalsAgg._sum.amount   ?? 0),
    todayWithdrawalsCount:    todayWithdrawalsAgg._count.id,
    pnlLast7Days,

    // Contas reais. `demoOnly` conta quem se registou e nunca financiou —
    // inclui quem nem chegou a operar em demo. `kycWithoutDeposit` é o buraco
    // do funil que interessa ver: gente que passou a verificação de identidade
    // (o passo chato) e mesmo assim parou antes de depositar.
    realAccounts:      withRealBalance,
    everDeposited:     depositors.length,
    realTraders:       realTraders.length,
    kycApproved,
    kycWithoutDeposit: Math.max(0, kycApproved - depositors.length),
    demoOnly:          Math.max(0, totalUsers - withRealBalance),
    conversionRate:    totalUsers > 0 ? Math.round((withRealBalance / totalUsers) * 1000) / 10 : 0,
  });
}
