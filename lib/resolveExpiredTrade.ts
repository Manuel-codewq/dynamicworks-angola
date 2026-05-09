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
 * Resolve uma operação expirada.
 * Ordem de prioridade para o preço de fecho:
 *   1. PriceCandle DB (gravado pelo price-recorder, < 90s)
 *   2. Deriv WS em tempo real
 *   3. clientPrice enviado pelo browser (fallback quando servidor não tem acesso ao mercado)
 *   4. Empate após 15s sem nenhuma fonte de preço
 */
export async function resolveExpiredTrade(
  trade: TradeToResolve,
  clientPrice?: number,
): Promise<ResolveOutcome> {
  if (trade.status !== "active") return "already_closed";

  const expiresAt = new Date(trade.createdAt.getTime() + trade.expirySecs * 1000);
  // Tolera 500ms de latência de rede antes de rejeitar como "pending"
  if (Date.now() < expiresAt.getTime() - 500) return "pending";

  let result:       "win" | "loss" | "draw";
  let closePrice:   number;
  let profit:       number;
  let returnAmount: number;

  // Via rápida: o browser já tem ligação Deriv WS activa — usa o preço que ele envia.
  // Via lenta: tenta PriceCandle DB ou Deriv WS no servidor (fallback se cliente não enviou).
  let resolvedPrice: number | null = null;

  if (clientPrice && clientPrice > 0) {
    // Preço do browser — resolução imediata sem esperar WS do servidor
    resolvedPrice = clientPrice;
  } else {
    resolvedPrice = await getClosePriceForAsset(trade.asset);
  }

  const expiredForMs = Date.now() - expiresAt.getTime();

  if (!resolvedPrice) {
    if (expiredForMs <= 15_000) return "pending";
    // Sem preço após 15s: empate — devolve a aposta
    result       = "draw";
    closePrice   = trade.entryPrice;
    profit       = 0;
    returnAmount = trade.amount;
  } else {
    closePrice      = resolvedPrice;
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
  }

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
