import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveExpiredTrade } from "@/lib/resolveExpiredTrade";
import { isOtcAsset } from "@/lib/derivPrice";

function isAuthorized(req: NextRequest): boolean {
  const workerSecret = process.env.WORKER_SECRET;
  const cronSecret   = process.env.CRON_SECRET;
  const xWorker      = req.headers.get("x-worker-secret");
  const auth         = req.headers.get("authorization");
  if (workerSecret && xWorker === workerSecret) return true;
  if (cronSecret   && auth   === `Bearer ${cronSecret}`) return true;
  if (workerSecret && auth   === `Bearer ${workerSecret}`) return true;
  return false;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const activeTrades = await prisma.trade.findMany({
    where:  { status: "active" },
    select: {
      id: true, userId: true, asset: true, symbol: true, direction: true, amount: true,
      entryPrice: true, payout: true, expirySecs: true, expiresAt: true,
      status: true, isDemo: true, tournamentParticipantId: true, createdAt: true,
      user: { select: { id: true, isDemo: true, email: true, name: true } },
    },
  });

  if (activeTrades.length === 0) {
    return NextResponse.json({ processed: 0, wins: 0, losses: 0 });
  }

  let wins = 0, losses = 0, processed = 0;

  await Promise.all(activeTrades.map(async (trade) => {
    const expiresAt = trade.expiresAt ?? new Date(trade.createdAt.getTime() + trade.expirySecs * 1000);
    if (new Date() < expiresAt) return;

    // Trades OTC: o cliente envia o exitPrice via WebSocket.
    // Se passaram mais de 2 minutos após expiração e ainda está activa, resolve como loss
    // para evitar que fiquem presas indefinidamente (ex: cliente fechou browser).
    if (isOtcAsset(trade.asset)) {
      const expiredForMs = Date.now() - expiresAt.getTime();
      if (expiredForMs < 120_000) return; // aguarda 2min antes de forçar
    }

    const outcome = await resolveExpiredTrade(trade);
    if (outcome === "pending" || outcome === "already_closed") return;

    processed++;
    if (outcome === "win")  wins++;
    if (outcome === "loss") losses++;
  }));

  return NextResponse.json({ processed, wins, losses });
}
