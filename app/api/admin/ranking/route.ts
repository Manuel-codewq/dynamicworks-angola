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
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (period === "month") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return null;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const period = new URL(req.url).searchParams.get("period") ?? "all";

  const eligibleUserIds = await prisma.transaction.findMany({
    where:    { type: "deposit", status: "completed" },
    select:   { userId: true },
    distinct: ["userId"],
  }).then(r => r.map(x => x.userId));

  if (eligibleUserIds.length === 0) return NextResponse.json({ ranking: [] });

  const { rankingResetAt } = await getSettings();
  const periodStart = getPeriodStart(period);

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
      userId: true, result: true, profit: true,
      user:   { select: { name: true, avatar: true } },
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
    .sort(([, a], [, b]) => b.profit - a.profit)
    .slice(0, 20);

  const ranking = sorted.map(([, e], i) => {
    const parts  = e.name.trim().split(" ");
    const masked = parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
    return {
      position: i + 1,
      name:     e.name,
      masked,
      avatar:   e.avatar ?? null,
      profit:   Math.round(e.profit),
      wins:     e.wins,
      total:    e.total,
      winRate:  Math.round((e.wins / e.total) * 100),
    };
  });

  return NextResponse.json({ ranking });
}
