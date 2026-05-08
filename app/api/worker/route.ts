import { NextRequest, NextResponse } from "next/server";
import { randomInt } from "crypto";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";

export async function GET(req: NextRequest) {
  // Endpoint interno — requer segredo partilhado (ex: chamado por cron externo)
  const secret = process.env.WORKER_SECRET;
  if (!secret || req.headers.get("x-worker-secret") !== secret) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const activeTrades = await prisma.trade.findMany({
    where:   { status: "active" },
    include: { user: { select: { id: true, isDemo: true } } },
  });

  if (activeTrades.length === 0) {
    return NextResponse.json({ processed: 0, wins: 0, losses: 0 });
  }

  const cfg = await getSettings();

  const now = new Date();
  let wins = 0;
  let losses = 0;
  let processed = 0;

  await Promise.all(
    activeTrades.map(async (trade) => {
      const expiresAt = new Date(trade.createdAt.getTime() + trade.expirySecs * 1000);
      if (now < expiresAt) return;

      const winProb = cfg.winProbability[trade.asset] ?? 0.47;

      const isWin = randomInt(0, 1_000_000) < Math.round(winProb * 1_000_000);

      const closePrice = isWin
        ? trade.entryPrice * (1 + randomInt(1, 20) / 10_000)
        : trade.entryPrice * (1 - randomInt(1, 20) / 10_000);

      const profit      = isWin ? trade.amount * trade.payout : -trade.amount;
      const returnAmount = isWin ? trade.amount + trade.amount * trade.payout : 0;

      // Atualizar trade e saldo em transação atómica
      // updateMany com WHERE status=active evita double-resolution
      await prisma.$transaction(async (tx) => {
        const closed = await tx.trade.updateMany({
          where: { id: trade.id, status: "active" },
          data: {
            status:    "closed",
            result:    isWin ? "win" : "loss",
            profit,
            closePrice,
            closedAt:  now,
          },
        });
        if (closed.count === 0) return; // já foi fechado por outra chamada

        if (returnAmount > 0) {
          if (trade.user.isDemo) {
            await tx.user.update({
              where: { id: trade.userId },
              data:  { demoBalance: { increment: returnAmount } },
            });
          } else {
            await tx.user.update({
              where: { id: trade.userId },
              data:  { balance: { increment: returnAmount } },
            });
          }
        }
      });

      processed++;
      if (isWin) wins++; else losses++;
    })
  );

  return NextResponse.json({ processed, wins, losses });
}
