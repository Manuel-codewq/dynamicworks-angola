import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";

function getPeriodStart(period: string): Date | null {
  const now = new Date();
  if (period === "today") {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (period === "week") {
    const d = new Date(now);
    d.setDate(d.getDate() - d.getDay()); // domingo
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (period === "month") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return null; // "all"
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const period = new URL(req.url).searchParams.get("period") ?? "all";

  const eligibleUserIds = await prisma.transaction.findMany({
    where:  { type: "deposit", status: "completed" },
    select: { userId: true },
    distinct: ["userId"],
  }).then(r => r.map(x => x.userId));

  if (eligibleUserIds.length === 0) return NextResponse.json({ ranking: [], myPosition: null });

  const { rankingResetAt } = await getSettings();
  const periodStart = getPeriodStart(period);

  // A data efectiva é a mais recente entre o reset do admin e o início do período
  let dateFilter: Date | null = null;
  if (periodStart && rankingResetAt) {
    dateFilter = periodStart > rankingResetAt ? periodStart : rankingResetAt;
  } else {
    dateFilter = periodStart ?? (rankingResetAt ?? null);
  }

  const trades = await prisma.trade.findMany({
    where: {
      status: "closed",
      isDemo: false,
      userId: { in: eligibleUserIds },
      user:   { isDemo: false },
      ...(dateFilter ? { createdAt: { gte: dateFilter } } : {}),
    },
    select: {
      userId: true, result: true, profit: true, amount: true,
      user: { select: { name: true, avatar: true } },
    },
  });

  const map = new Map<string, { name: string; avatar: string | null; profit: number; wins: number; total: number }>();
  for (const t of trades) {
    const entry = map.get(t.userId) ?? { name: t.user.name, avatar: t.user.avatar ?? null, profit: 0, wins: 0, total: 0 };
    entry.profit += t.profit ?? 0;
    entry.total  += 1;
    if (t.result === "win") entry.wins += 1;
    map.set(t.userId, entry);
  }

  const sorted = Array.from(map.entries())
    .filter(([, e]) => e.total >= 1)
    .sort(([, a], [, b]) => b.profit - a.profit);

  // Posição do utilizador actual
  const myIdx = sorted.findIndex(([uid]) => uid === session.user?.id);
  const myPosition = myIdx >= 0 ? myIdx + 1 : null;
  const myEntry    = myIdx >= 0 ? sorted[myIdx] : null;

  const ranking = sorted.slice(0, 20).map(([uid, e], i) => {
    const parts  = e.name.trim().split(" ");
    const masked = parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
    return {
      position: i + 1,
      name:     masked,
      avatar:   e.avatar ?? null,
      profit:   Math.round(e.profit),
      wins:     e.wins,
      total:    e.total,
      winRate:  Math.round((e.wins / e.total) * 100),
      isMe:     uid === session.user?.id,
    };
  });

  // Se o utilizador não está no top 20, incluir a sua entrada
  const myRankEntry = myPosition && myPosition > 20 && myEntry ? {
    position: myPosition,
    name: "Tu",
    avatar: null,
    profit: Math.round(myEntry[1].profit),
    wins:   myEntry[1].wins,
    total:  myEntry[1].total,
    winRate: Math.round((myEntry[1].wins / myEntry[1].total) * 100),
    isMe: true,
  } : null;

  return NextResponse.json({ ranking, myPosition, myRankEntry });
}
