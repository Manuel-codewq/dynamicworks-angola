import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const wins = await prisma.trade.findMany({
    where:   { result: "win", status: "closed", isDemo: false, user: { isDemo: false } },
    orderBy: { closedAt: "desc" },
    take:    20,
    include: { user: { select: { name: true } } },
  });

  return NextResponse.json(
    wins.map(w => {
      const parts = w.user.name.trim().split(" ");
      const masked = parts.length > 1
        ? `${parts[0]} ${parts[parts.length - 1][0]}.`
        : parts[0];
      return {
        name:   masked,
        amount: Math.round(w.profit ?? 0),
        asset:  w.asset,
        time:   w.closedAt,
      };
    })
  );
}
