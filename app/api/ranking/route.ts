import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  // Only include trades from users currently on real account (isDemo: false)
  // This avoids false positives from old trades that defaulted to isDemo=false
  const trades = await prisma.trade.findMany({
    where:   { status: "closed", isDemo: false, user: { isDemo: false } },
    select:  { userId: true, result: true, profit: true, amount: true, user: { select: { name: true } } },
  });

  const map = new Map<string, { name: string; profit: number; wins: number; total: number }>();

  for (const t of trades) {
    const entry = map.get(t.userId) ?? { name: t.user.name, profit: 0, wins: 0, total: 0 };
    entry.profit += t.profit ?? 0;
    entry.total  += 1;
    if (t.result === "win") entry.wins += 1;
    map.set(t.userId, entry);
  }

  const ranking = Array.from(map.values())
    .filter(e => e.total >= 1)
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 20)
    .map((e, i) => {
      const parts = e.name.trim().split(" ");
      const masked = parts.length > 1
        ? `${parts[0]} ${parts[parts.length - 1][0]}.`
        : parts[0];
      return {
        position: i + 1,
        name:     masked,
        profit:   Math.round(e.profit),
        wins:     e.wins,
        total:    e.total,
        winRate:  Math.round((e.wins / e.total) * 100),
      };
    });

  return NextResponse.json(ranking);
}
