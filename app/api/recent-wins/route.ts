import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const wins = await prisma.trade.findMany({
    where:   { result: "win", status: "closed" },
    orderBy: { closedAt: "desc" },
    take:    20,
    include: { user: { select: { name: true } } },
  });

  return NextResponse.json(
    wins.map(w => ({
      name:   w.user.name,
      amount: Math.round(w.profit ?? 0),
      asset:  w.asset,
      time:   w.closedAt,
    }))
  );
}
