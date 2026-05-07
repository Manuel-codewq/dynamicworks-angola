import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { settings } from "@/lib/settings";

export async function GET() {
  const activeTrades = await prisma.trade.findMany({
    where:   { status: "active" },
    include: { user: { select: { id: true, isDemo: true, balance: true, demoBalance: true } } },
  });

  if (activeTrades.length === 0) {
    return NextResponse.json({ processed: 0, wins: 0, losses: 0 });
  }

  const now = new Date();
  let wins = 0;
  let losses = 0;
  let processed = 0;

  await Promise.all(
    activeTrades.map(async (trade) => {
      const expiresAt = new Date(trade.createdAt.getTime() + trade.expirySecs * 1000);
      if (now < expiresAt) return; // not yet expired

      const winProb = settings.winProbability[trade.asset] ?? 0.47;
      const isWin   = Math.random() < winProb;

      const closePrice = isWin
        ? trade.entryPrice * (1 + Math.random() * 0.002)
        : trade.entryPrice * (1 - Math.random() * 0.002);

      const profit = isWin ? trade.amount * trade.payout : -trade.amount;
      const returnAmount = isWin ? trade.amount + trade.amount * trade.payout : 0;

      await prisma.trade.update({
        where: { id: trade.id },
        data: {
          status:     "closed",
          result:     isWin ? "win" : "loss",
          profit,
          closePrice,
          closedAt:   now,
        },
      });

      if (returnAmount > 0) {
        if (trade.user.isDemo) {
          await prisma.user.update({
            where: { id: trade.userId },
            data:  { demoBalance: { increment: returnAmount } },
          });
        } else {
          await prisma.user.update({
            where: { id: trade.userId },
            data:  { balance: { increment: returnAmount } },
          });
        }
      }

      processed++;
      if (isWin) wins++; else losses++;
    })
  );

  return NextResponse.json({ processed, wins, losses });
}
