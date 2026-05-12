import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const [users, trades, volumeAgg] = await Promise.all([
    prisma.user.count({ where: { role: "user" } }),
    prisma.trade.count({ where: { status: "closed", isDemo: false } }),
    prisma.trade.aggregate({
      where: { status: "closed", isDemo: false },
      _sum: { amount: true },
    }),
  ]);

  const volume = volumeAgg._sum.amount ?? 0;

  return NextResponse.json({ users, trades, volume });
}
