import { prisma } from "@/lib/prisma";
import { getDerivPrice } from "@/lib/derivPrice";
import { sendTradeWinEmail, sendTradeLossEmail } from "@/lib/email";

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

// Empates removidos — qualquer movimento determina win ou loss

export type TradeToResolve = {
  id:         string;
  userId:     string;
  asset:      string;
  direction:  string;
  amount:     number;
  entryPrice: number;
  payout:     number;
  expirySecs: number;
  expiresAt:  Date | null;
  status:     string;
  createdAt:  Date;
  user:       { id: string; isDemo: boolean; email: string; name: string | null };
};

export type ResolveOutcome = "pending" | "already_closed" | "win" | "loss";

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

  // Usa expiresAt da DB (autoridade do servidor); fallback para cálculo se trade antigo
  const expiresAt = trade.expiresAt ?? new Date(trade.createdAt.getTime() + trade.expirySecs * 1000);
  // Tolera 500ms de latência de rede antes de rejeitar como "pending"
  if (Date.now() < expiresAt.getTime() - 500) return "pending";

  let result:       "win" | "loss" | "draw";
  let closePrice:   number;
  let profit:       number;
  let returnAmount: number;

  // Via rápida: o browser já tem ligação Deriv WS activa — usa o preço que ele envia.
  // Via lenta: tenta PriceCandle DB ou Deriv WS no servidor (fallback se cliente não enviou).
  let resolvedPrice: number | null = null;

  // Sempre tenta o preço do servidor primeiro; clientPrice só é usado se o servidor
  // não tiver preço disponível (mercado fechado, falha de rede, etc.)
  resolvedPrice = await getClosePriceForAsset(trade.asset);

  if (!resolvedPrice && clientPrice && clientPrice > 0) {
    // Fallback: preço do browser apenas quando o servidor não tem dados.
    // Valida desvio máximo de ±5% para limitar margem de manipulação.
    const deviation = Math.abs(clientPrice - trade.entryPrice) / trade.entryPrice;
    if (deviation <= 0.05) {
      resolvedPrice = clientPrice;
    }
  }

  const expiredForMs = Date.now() - expiresAt.getTime();

  if (!resolvedPrice) {
    if (expiredForMs <= 30_000) return "pending";
    // Sem preço após 30s: loss (não existe empate)
    result       = "loss";
    closePrice   = trade.entryPrice;
    profit       = -trade.amount;
    returnAmount = 0;
  } else {
    closePrice = resolvedPrice;
    const diff = closePrice - trade.entryPrice;

    // Qualquer movimento — mesmo mínimo — determina win ou loss; sem empates
    const priceWon = trade.direction === "call" ? diff > 0 : diff < 0;
    result = priceWon ? "win" : "loss";

    profit       = result === "win" ? trade.amount * trade.payout : -trade.amount;
    returnAmount = result === "win" ? trade.amount + trade.amount * trade.payout : 0;
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

  // Update tournament participant stats for real (non-demo) trades
  if (resolved && !trade.user.isDemo) {
    try {
      const participants = await prisma.tournamentParticipant.findMany({
        where: {
          userId: trade.userId,
          tournament: {
            status: "active",
            startDate: { lte: trade.createdAt },
            endDate:   { gte: trade.createdAt },
          },
        },
      });
      for (const tp of participants) {
        await prisma.tournamentParticipant.update({
          where: { id: tp.id },
          data: {
            profit: { increment: profit },
            trades: { increment: 1 },
            wins:   { increment: result === "win" ? 1 : 0 },
          },
        });
      }
    } catch { /* silent — never fail trade resolution */ }
  }

  // Email throttle: só envia 1 email de resultado por utilizador a cada 4 horas
  if (resolved && !trade.user.isDemo) {
    try {
      const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
      const recentEmail = await prisma.notification.findFirst({
        where: {
          userId: trade.userId,
          type:   "trade_email_sent",
          createdAt: { gte: fourHoursAgo },
        },
        select: { id: true },
      });

      if (!recentEmail) {
        await prisma.notification.create({
          data: {
            userId:  trade.userId,
            type:    "trade_email_sent",
            title:   "Email de resultado enviado",
            message: `Resultado: ${result}`,
            read:    true,
          },
        });
        const userName = trade.user.name ?? "Trader";
        if (result === "win") {
          sendTradeWinEmail(trade.user.email, userName, trade.asset, trade.amount, profit, returnAmount).catch(() => {});
        } else {
          sendTradeLossEmail(trade.user.email, userName, trade.asset, trade.amount).catch(() => {});
        }
      }
    } catch { /* silent — nunca falhar a resolução de trade por causa do email */ }
  }

  return resolved ? result : "already_closed";
}
