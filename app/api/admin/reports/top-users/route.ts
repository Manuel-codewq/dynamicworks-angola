import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const days  = Math.min(90, Math.max(1, parseInt(searchParams.get("days") ?? "30")));
  const limit = Math.min(50, Math.max(5, parseInt(searchParams.get("limit") ?? "20")));

  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const trades = await prisma.trade.findMany({
    where:  { status: "closed", isDemo: false, closedAt: { gte: since } },
    select: {
      userId: true, result: true, amount: true, payout: true,
      user:   { select: { name: true, email: true } },
    },
  });

  const map: Record<string, {
    name: string; email: string;
    trades: number; wins: number; totalBet: number; netWin: number;
  }> = {};

  for (const t of trades) {
    if (!map[t.userId]) map[t.userId] = { name: t.user.name ?? "—", email: t.user.email, trades: 0, wins: 0, totalBet: 0, netWin: 0 };
    const u = map[t.userId];
    u.trades++;
    u.totalBet += t.amount;
    if (t.result === "win") {
      u.wins++;
      u.netWin += t.amount * t.payout;  // quanto recebeu de volta (lucro para o utilizador)
    } else {
      u.netWin -= t.amount;             // perdeu o montante
    }
  }

  const rows = Object.entries(map)
    .map(([userId, u]) => ({
      userId,
      name:    u.name,
      email:   u.email,
      trades:  u.trades,
      wins:    u.wins,
      winRate: u.trades > 0 ? Math.round((u.wins / u.trades) * 100) : 0,
      totalBet: Math.round(u.totalBet),
      netWin:   Math.round(u.netWin),
    }))
    .sort((a, b) => b.netWin - a.netWin) // quem ganhou mais (maior risco para corretora)
    .slice(0, limit);

  return NextResponse.json(rows);
}
