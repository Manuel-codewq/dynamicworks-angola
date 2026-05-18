import { prisma } from "@/lib/prisma";
import { getDerivPrice, isOtcAsset } from "@/lib/derivPrice";
import { sendTradeWinEmail, sendTradeLossEmail } from "@/lib/email";
import { sendPushToUser } from "@/lib/webPush";

async function getClosePriceForAsset(asset: string): Promise<number | null> {
  // Pares OTC: preço vem do cliente (clientPrice) — não há fonte server-side independente
  // O entryPrice também foi do cliente, por isso a comparação é consistente
  if (isOtcAsset(asset)) return null;

  // Pares reais: PriceCandle DB → Deriv WS
  try {
    const ninetySecsAgo = new Date(Date.now() - 90_000);
    const candle = await prisma.priceCandle.findFirst({
      where:   { asset, timestamp: { gte: ninetySecsAgo } },
      orderBy: { timestamp: "desc" },
      select:  { close: true },
    });
    if (candle?.close && candle.close > 0) return candle.close;
  } catch { /* ignora erros de DB */ }
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
 *   3. Loss automático após 30s sem preço (sem aceitar clientPrice — manipulável)
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

  // Preço de fecho: PriceCandle DB → Deriv WS → clientPrice
  // O clientPrice é o tick exacto no momento de expiração (WebSocket em tempo real).
  // O PriceCandle é o close do candle de 1 minuto — pode diferir do tick exacto.
  // Estratégia: usar clientPrice quando está próximo do servidor (< 0.5% de diferença)
  // porque representa o preço REAL que o utilizador vê no ecrã no momento da expiração.
  let resolvedPrice: number | null = await getClosePriceForAsset(trade.asset);

  if (clientPrice && clientPrice > 0) {
    if (!resolvedPrice) {
      // Sem preço do servidor — usar client
      resolvedPrice = clientPrice;
    } else {
      // Usar clientPrice se estiver dentro de 0.5% do servidor
      // (mesmo tick, latência diferente — client é mais preciso no momento exacto)
      const pctDiff = Math.abs(clientPrice - resolvedPrice) / resolvedPrice;
      if (pctDiff < 0.005) {
        resolvedPrice = clientPrice;
      }
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

  // Verificar 3 wins consecutivos → convidar para grupo WhatsApp
  if (resolved && result === "win") {
    try {
      const WHATSAPP_GROUP = "https://chat.whatsapp.com/CWGZZp0UV7601Dj7MF5awo";
      const lastTrades = await prisma.trade.findMany({
        where:   { userId: trade.userId, isDemo: trade.user.isDemo, status: "closed" },
        orderBy: { closedAt: "desc" },
        take:    3,
        select:  { result: true },
      });
      const hasThreeConsecWins = lastTrades.length === 3 && lastTrades.every(t => t.result === "win");
      if (hasThreeConsecWins) {
        // Só enviar uma vez — verificar se já recebeu este convite
        const alreadySent = await prisma.notification.findFirst({
          where: { userId: trade.userId, type: "whatsapp_invite" },
          select: { id: true },
        });
        if (!alreadySent) {
          await prisma.notification.create({
            data: {
              userId:  trade.userId,
              type:    "whatsapp_invite",
              title:   "Parabéns! Junta-te ao grupo VIP",
              message: `Atingiste 3 vitórias consecutivas! Mereces entrar no nosso grupo exclusivo de traders. Clica para entrar: ${WHATSAPP_GROUP}`,
              read:    false,
            },
          });
          sendPushToUser(trade.userId, {
            title: "3 wins seguidos! Grupo VIP",
            body:  "Parabéns! Atingiste 3 vitórias consecutivas. Clica para entrar no grupo exclusivo de traders.",
            url:   WHATSAPP_GROUP,
            tag:   "whatsapp-invite",
          }).catch(() => {});
        }
      }
    } catch { /* silent */ }
  }

  // Actualizar participantes de torneios — real ou demo conforme o tipo do trade
  if (resolved) {
    try {
      const participants = await prisma.tournamentParticipant.findMany({
        where: {
          userId: trade.userId,
          tournament: {
            status:  "active",
            isDemo:  trade.user.isDemo,
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

  if (resolved) {
    const profitKz = Math.floor(Math.abs(profit)).toLocaleString("pt-PT");
    const amountKz = Math.floor(trade.amount).toLocaleString("pt-PT");
    const demoTag  = trade.user.isDemo ? " (Demo)" : "";

    // ── 1. Notificação in-app — sempre, demo e real ───────────────────────────
    prisma.notification.create({
      data: {
        userId:  trade.userId,
        type:    result === "win" ? "trade_win" : "trade_loss",
        title:   result === "win"
          ? `Ganhou ${profitKz} Kz${demoTag}`
          : `Operação encerrada — ${trade.asset}${demoTag}`,
        message: result === "win"
          ? `A tua operação de ${amountKz} Kz em ${trade.asset} foi resolvida a teu favor!`
          : `Perdeste ${amountKz} Kz em ${trade.asset}. Analisa e tenta novamente.`,
        read: false,
      },
    }).catch(() => {});

    // ── 2. Push — sempre, demo e real ────────────────────────────────────────
    sendPushToUser(trade.userId, {
      title: result === "win"
        ? `✅ Ganhou ${profitKz} Kz${demoTag}`
        : `❌ Operação perdida — ${trade.asset}`,
      body: result === "win"
        ? `${trade.asset} · A operação foi resolvida a teu favor!`
        : `Perdeste ${amountKz} Kz. Continua a tentar!`,
      url:   "/trade",
      tag:   "trade-result",
    }).catch(() => {});

    // ── 3. Email — só para trades reais, throttle 4h ──────────────────────────
    if (!trade.user.isDemo) {
      const userName = trade.user.name ?? "Trader";
      try {
        const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
        const recentEmail  = await prisma.notification.findFirst({
          where:  { userId: trade.userId, type: "trade_email_sent", createdAt: { gte: fourHoursAgo } },
          select: { id: true },
        });
        if (!recentEmail) {
          await prisma.notification.create({
            data: { userId: trade.userId, type: "trade_email_sent", title: "Email enviado", message: "", read: true },
          });
          if (result === "win") {
            sendTradeWinEmail(trade.user.email, userName, trade.asset, trade.amount, profit, returnAmount).catch(() => {});
          } else {
            sendTradeLossEmail(trade.user.email, userName, trade.asset, trade.amount).catch(() => {});
          }
        }
      } catch { /* silent */ }
    }
  }

  return resolved ? result : "already_closed";
}
