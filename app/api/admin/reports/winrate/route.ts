import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const [trades, cfg] = await Promise.all([
    prisma.trade.findMany({
      where:  { status: "closed", isDemo: false },
      select: { asset: true, result: true },
    }),
    getSettings(),
  ]);

  const map: Record<string, { wins: number; total: number }> = {};
  for (const t of trades) {
    if (!map[t.asset]) map[t.asset] = { wins: 0, total: 0 };
    map[t.asset].total++;
    if (t.result === "win") map[t.asset].wins++;
  }

  const rows = Object.entries(map)
    .map(([asset, { wins, total }]) => ({
      asset,
      wins,
      total,
      winRate:       total > 0 ? Math.round((wins / total) * 100) : 0,
      configuredPct: Math.round((cfg.winProbability[asset] ?? 0.47) * 100),
    }))
    .sort((a, b) => b.total - a.total);

  return NextResponse.json(rows);
}
