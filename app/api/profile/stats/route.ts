import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const userId = session.user.id;

  const trades = await prisma.trade.findMany({
    where:   { userId, status: "closed", isDemo: false },
    select:  { asset: true, result: true, profit: true, amount: true, closedAt: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const total  = trades.length;
  const wins   = trades.filter(t => t.result === "win").length;
  const losses = trades.filter(t => t.result === "loss").length;
  const totalProfit  = trades.reduce((s, t) => s + (t.profit ?? 0), 0);
  const totalVolume  = trades.reduce((s, t) => s + t.amount, 0);
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

  // P&L acumulado por dia (últimos 30 dias)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentTrades  = trades.filter(t => new Date(t.createdAt) >= thirtyDaysAgo);

  const dailyMap: Record<string, number> = {};
  for (const t of recentTrades) {
    const day = new Date(t.createdAt).toISOString().slice(0, 10);
    dailyMap[day] = (dailyMap[day] ?? 0) + (t.profit ?? 0);
  }

  // Preencher dias sem trades com 0 e calcular P&L acumulado
  const dailyPnl: { date: string; pnl: number; cumulative: number }[] = [];
  let cumulative = 0;
  for (let i = 29; i >= 0; i--) {
    const d   = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const pnl = dailyMap[d] ?? 0;
    cumulative += pnl;
    dailyPnl.push({ date: d, pnl, cumulative });
  }

  // Breakdown por par (top 8)
  const assetMap: Record<string, { trades: number; wins: number; profit: number; volume: number }> = {};
  for (const t of trades) {
    if (!assetMap[t.asset]) assetMap[t.asset] = { trades: 0, wins: 0, profit: 0, volume: 0 };
    assetMap[t.asset].trades++;
    assetMap[t.asset].volume += t.amount;
    assetMap[t.asset].profit += t.profit ?? 0;
    if (t.result === "win") assetMap[t.asset].wins++;
  }

  const byAsset = Object.entries(assetMap)
    .map(([asset, v]) => ({ asset, ...v, winRate: Math.round((v.wins / v.trades) * 100) }))
    .sort((a, b) => b.trades - a.trades)
    .slice(0, 8);

  // Últimas 10 operações
  const recent = trades.slice(-10).reverse().map(t => ({
    asset:  t.asset,
    result: t.result,
    profit: t.profit,
    amount: t.amount,
    date:   t.closedAt ?? t.createdAt,
  }));

  return NextResponse.json({ total, wins, losses, winRate, totalProfit, totalVolume, dailyPnl, byAsset, recent });
}
