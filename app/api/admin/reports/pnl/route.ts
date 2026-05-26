import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const days = Math.min(90, Math.max(7, parseInt(searchParams.get("days") ?? "30")));

  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const trades = await prisma.trade.findMany({
    where:  { status: "closed", isDemo: false, closedAt: { gte: since } },
    select: { closedAt: true, result: true, amount: true, payout: true },
  });

  const byDay: Record<string, { profit: number; trades: number; wins: number }> = {};

  for (const t of trades) {
    const day = (t.closedAt ?? new Date()).toISOString().slice(0, 10);
    if (!byDay[day]) byDay[day] = { profit: 0, trades: 0, wins: 0 };
    byDay[day].trades++;
    if (t.result === "win") {
      byDay[day].wins++;
      byDay[day].profit -= t.amount * t.payout; // corretora paga
    } else {
      byDay[day].profit += t.amount; // corretora fica com o montante
    }
  }

  // Fill missing days
  const result = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    const key  = d.toISOString().slice(0, 10);
    const data = byDay[key] ?? { profit: 0, trades: 0, wins: 0 };
    result.push({
      date:    key,
      profit:  Math.round(data.profit),
      trades:  data.trades,
      winRate: data.trades > 0 ? Math.round((data.wins / data.trades) * 100) : null,
    });
  }

  return NextResponse.json(result);
}
