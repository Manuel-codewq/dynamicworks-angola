import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || (session.user as any).role !== "admin")
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const now = new Date();
  const days: { date: string; revenue: number; trades: number; newUsers: number; deposits: number }[] = [];

  for (let i = 29; i >= 0; i--) {
    const start = new Date(now);
    start.setDate(now.getDate() - i);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCHours(23, 59, 59, 999);

    const [closedTrades, newUsers, deposits] = await Promise.all([
      prisma.trade.findMany({
        where: { status: "closed", closedAt: { gte: start, lte: end } },
        select: { result: true, amount: true },
      }),
      prisma.user.count({ where: { createdAt: { gte: start, lte: end } } }),
      prisma.transaction.aggregate({
        where: { type: "deposit", status: "completed", createdAt: { gte: start, lte: end } },
        _sum: { amount: true },
      }),
    ]);

    const revenue = closedTrades
      .filter(t => t.result === "loss")
      .reduce((s, t) => s + t.amount, 0);

    days.push({
      date: start.toISOString().slice(0, 10),
      revenue: Math.round(revenue),
      trades: closedTrades.length,
      newUsers,
      deposits: Math.round(deposits._sum.amount ?? 0),
    });
  }

  return NextResponse.json(days);
}
