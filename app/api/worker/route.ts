import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveExpiredTrade } from "@/lib/resolveExpiredTrade";

export async function GET(req: NextRequest) {
  const secret = process.env.WORKER_SECRET;
  if (!secret || req.headers.get("x-worker-secret") !== secret) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const activeTrades = await prisma.trade.findMany({
    where:   { status: "active" },
    include: { user: { select: { id: true, isDemo: true } } },
  });

  if (activeTrades.length === 0) {
    return NextResponse.json({ processed: 0, wins: 0, losses: 0, draws: 0 });
  }

  let wins = 0, losses = 0, draws = 0, processed = 0;

  await Promise.all(activeTrades.map(async (trade) => {
    // Quick pre-check before hitting resolveExpiredTrade (avoids settings fetch for pending trades)
    const expiresAt = new Date(trade.createdAt.getTime() + trade.expirySecs * 1000);
    if (new Date() < expiresAt) return;

    const outcome = await resolveExpiredTrade(trade);
    if (outcome === "pending" || outcome === "already_closed") return;

    processed++;
    if (outcome === "win")  wins++;
    if (outcome === "loss") losses++;
    if (outcome === "draw") draws++;
  }));

  return NextResponse.json({ processed, wins, losses, draws });
}
