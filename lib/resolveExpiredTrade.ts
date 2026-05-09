import { prisma } from "@/lib/prisma";
import { getDerivPrice } from "@/lib/derivPrice";

// Tenta o preço mais recente da tabela PriceCandle (gravado pelo price-recorder).
// Se não existir ou for demasiado antigo (> 90s), vai buscar ao Deriv via WS.
async function getClosePriceForAsset(asset: string): Promise<number | null> {
  try {
    const ninetySecsAgo = new Date(Date.now() - 90_000);
    const candle = await prisma.priceCandle.findFirst({
      where:   { asset, timestamp: { gte: ninetySecsAgo } },
      orderBy: { timestamp: "desc" },
      select:  { close: true },
    });
    if (candle?.close && candle.close > 0) return candle.close;
  } catch { /* ignora erros de DB, faz fallback */ }
  return getDerivPrice(asset);
}

// Margem mínima de movimento para não ser considerado empate (5 pips / 5 cents)
const DRAW_THRESHOLD = 0.00005;

export type TradeToResolve = {
  id:         string;
  userId:     string;
  asset:      string;
  direction:  string;
  amount:     number;
  entryPrice: number;
  payout:     number;
  expirySecs: number;
  status:     string;
  createdAt:  Date;
  user:       { id: string; isDemo: boolean };
};

export type ResolveOutcome = "pending" | "already_closed" | "win" | "loss" | "draw";

/**
 * Resolve uma operação expirada comparando o preço de fecho (obtido
 * server-side via Deriv WS) com o preço de entrada registado na abertura.
 * O cliente não fornece preços — toda a resolução é feita no servidor.
 */
export async function resolveExpiredTrade(
  trade: TradeToResolve,
): Promise<ResolveOutcome> {
  if (trade.status !== "active") return "already_closed";

  const expiresAt = new Date(trade.createdAt.getTime() + trade.expirySecs * 1000);
  if (new Date() < expiresAt) return "pending";

  let result:       "win" | "loss" | "draw";
  let closePrice:   number;
  let profit:       number;
  let returnAmount: number;

  // Preço obtido exclusivamente no servidor — cliente não pode influenciar.
  // Tenta a cache DB primeiro (rápido), depois WS Deriv como fallback.
  const fetchedPrice = await getClosePriceForAsset(trade.asset);
  if (!fetchedPrice) {
    // Mercado fechado ou Deriv inacessível — resolve no próximo ciclo do worker
    return "pending";
  }
  closePrice      = fetchedPrice;
  const diff      = closePrice - trade.entryPrice;
  const absDiff   = Math.abs(diff);
  const threshold = trade.entryPrice * DRAW_THRESHOLD;

  if (absDiff <= threshold) {
    result = "draw";
  } else {
    const priceWon = trade.direction === "call" ? diff > 0 : diff < 0;
    result = priceWon ? "win" : "loss";
  }

  profit       = result === "win"  ? trade.amount * trade.payout
               : result === "loss" ? -trade.amount
               : 0;
  returnAmount = result === "win"  ? trade.amount + trade.amount * trade.payout
               : result === "draw" ? trade.amount
               : 0;

  let resolved = false;
  await prisma.$transaction(async (tx) => {
    const closed = await tx.trade.updateMany({
      where: { id: trade.id, status: "active" },
      data:  { status: "closed", result, profit, closePrice, closedAt: new Date() },
    });
    if (closed.count === 0) return;
    resolved = true;
    if (returnAmount > 0) {
      const field = trade.user.isDemo ? "demoBalance" : "balance";
      await tx.user.update({
        where: { id: trade.userId },
        data:  { [field]: { increment: returnAmount } },
      });
    }
  });

  return resolved ? result : "already_closed";
}
