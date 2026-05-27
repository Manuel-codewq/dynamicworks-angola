import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const userId   = session.user.id;
  const todayUTC = new Date(); todayUTC.setUTCHours(0, 0, 0, 0);

  const [todayStats, allTimeStats] = await Promise.all([
    prisma.trade.groupBy({
      by: ["result", "isDemo"],
      where: { userId, status: "closed", closedAt: { gte: todayUTC } },
      _sum:   { profit: true },
      _count: { id: true },
    }),
    prisma.trade.groupBy({
      by: ["result", "isDemo"],
      where: { userId, status: "closed" },
      _sum:   { profit: true },
      _count: { id: true },
    }),
  ]);

  function extract(rows: { result: string | null; isDemo: boolean; _sum: { profit: number | null }; _count: { id: number } }[], demo: boolean) {
    const mine  = rows.filter(r => r.isDemo === demo);
    const pnl   = mine.reduce((s, r) => s + (r._sum.profit ?? 0), 0);
    const wins  = mine.filter(r => r.result === "win").reduce((s, r) => s + r._count.id, 0);
    const total = mine.reduce((s, r) => s + r._count.id, 0);
    return { pnl: Math.round(pnl), wins, losses: total - wins, total };
  }

  return NextResponse.json({
    today:   { real: extract(todayStats, false),   demo: extract(todayStats, true)   },
    allTime: { real: extract(allTimeStats, false),  demo: extract(allTimeStats, true)  },
  });
}
