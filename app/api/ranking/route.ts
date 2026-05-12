import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  // Só utilizadores com pelo menos 1 depósito aprovado podem aparecer no ranking
  const eligibleUserIds = await prisma.transaction.findMany({
    where:  { type: "deposit", status: "completed" },
    select: { userId: true },
    distinct: ["userId"],
  }).then(r => r.map(x => x.userId));

  if (eligibleUserIds.length === 0) return NextResponse.json([]);

  const trades = await prisma.trade.findMany({
    where: {
      status: "closed",
      isDemo: false,
      userId: { in: eligibleUserIds },
      user:   { isDemo: false },
    },
    select: { userId: true, result: true, profit: true, amount: true, user: { select: { name: true, avatar: true } } },
  });

  const map = new Map<string, { name: string; avatar: string | null; profit: number; wins: number; total: number }>();

  for (const t of trades) {
    const entry = map.get(t.userId) ?? { name: t.user.name, avatar: t.user.avatar ?? null, profit: 0, wins: 0, total: 0 };
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
        avatar:   e.avatar ?? null,
        profit:   Math.round(e.profit),
        wins:     e.wins,
        total:    e.total,
        winRate:  Math.round((e.wins / e.total) * 100),
      };
    });

  return NextResponse.json(ranking);
}
