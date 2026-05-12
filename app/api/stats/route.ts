import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

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
