import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const showDemo = searchParams.get("demo") === "true";

  const wins = await prisma.trade.findMany({
    where:   { userId: session.user.id, result: "win", status: "closed", isDemo: showDemo },
    orderBy: { closedAt: "desc" },
    take:    8,
    select:  { profit: true, asset: true, closedAt: true },
  });

  return NextResponse.json(
    wins.map(w => ({
      amount: Math.round(w.profit ?? 0),
      asset:  w.asset,
      time:   w.closedAt,
    }))
  );
}
