import { prisma } from "@/lib/prisma";
import { getDerivPrice, getDerivPriceAt } from "@/lib/syntheticFeed";
import { sendTradeWinEmail, sendTradeLossEmail } from "@/lib/email";
import { sendPushToUser } from "@/lib/webPush";

// expiresAt é o instante em que a operação devia fechar. getDerivPriceAt()
// devolve o preço "agora" do synthetic-engine (ver lib/syntheticFeed.ts para
// a limitação conhecida sobre fechos tardios via cron); mantido como
// parâmetro explícito para deixar essa intenção clara neste call site.
async function getClosePriceForAsset(asset: string, expiresAt: Date): Promise<number | null> {
  // 1ª prioridade: preço do synthetic-engine ancorado ao instante de expiração
  try {
    const anchoredPrice = await getDerivPriceAt(asset, expiresAt.getTime());
    if (anchoredPrice && anchoredPrice > 0) return anchoredPrice;
  } catch { /* cai para preço "agora" */ }

  // 2ª prioridade: preço "agora" — só chega aqui se a chamada acima falhar
  // (ex.: synthetic-engine em baixo, ou activo sem símbolo mapeado)
  try {
    const livePrice = await getDerivPrice(asset);
    if (livePrice && livePrice > 0) return livePrice;
  } catch { /* fallback para DB */ }

  // Fallback final: candle da BD mais próxima do instante de expiração (não a
  // mais recente disponível — teria o mesmo problema do preço "agora")
  try {
    const windowStart = new Date(expiresAt.getTime() - 5 * 60_000);
    const candle = await prisma.priceCandle.findFirst({
      where:   { asset, timestamp: { gte: windowStart, lte: expiresAt } },
      orderBy: { timestamp: "desc" },
      select:  { close: true },
    });
    if (candle?.close && candle.close > 0) return candle.close;
  } catch { /* ignora */ }

  return null;
}

// Qualquer movimento determina win ou loss; só um preço de fecho idêntico ao
// cêntimo ao de entrada conta como empate (draw) — devolve-se o valor apostado.

export type TradeToResolve = {
  id:         string;
  userId:     string;
  asset:      string;
  symbol:     string | null;
  direction:  string;
  amount:     number;
  entryPrice: number;
  payout:     number;
  expirySecs: number;
  expiresAt:  Date | null;
  status:     string;
  isDemo:     boolean;
  tournamentParticipantId: string | null;
  createdAt:  Date;
  user:       { id: string; isDemo: boolean; email: string; name: string | null };
};

export type ResolveOutcome = "pending" | "already_closed" | "win" | "loss" | "draw";

/**
 * Resolve uma operação expirada.
 *
 * O preço de fecho é SEMPRE determinado pelo servidor — nunca pelo cliente.
 * Aceitar o preço enviado pelo browser permitiria ao utilizador forjar um
 * `exitPrice` do lado vencedor da entrada e ganhar praticamente todas as
 * operações (o resultado depende apenas de qual lado da entrada o preço fica).
 *
 * Ordem de prioridade para o preço de fecho:
 *   1. synthetic-engine, preço "agora" (ver lib/syntheticFeed.ts)
 *   2. PriceCandle DB (gravado pelo price-recorder, < 5 min)
 *   3. Sem preço após 30s → loss automático (fallback de segurança)
 */
export async function resolveExpiredTrade(
  trade: TradeToResolve,
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

  // Preço de fecho: ancorado ao instante exacto de expiração — nunca ao
  // instante em que o worker efectivamente corre. Apenas fontes do servidor.
  const resolvedPrice: number | null = await getClosePriceForAsset(trade.asset, expiresAt);

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

    if (diff === 0) {
      // Preço de fecho idêntico ao de entrada (ao cêntimo) — não é justo contar
      // como derrota para qualquer direcção. Devolve-se o valor apostado.
      result       = "draw";
      profit       = 0;
      returnAmount = trade.amount;
    } else {
      const priceWon = trade.direction === "call" ? diff > 0 : diff < 0;
      result = priceWon ? "win" : "loss";

      profit       = result === "win" ? trade.amount * trade.payout : -trade.amount;
      returnAmount = result === "win" ? trade.amount + trade.amount * trade.payout : 0;
    }
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
      if (trade.tournamentParticipantId) {
        await tx.tournamentParticipant.update({
          where: { id: trade.tournamentParticipantId },
          data:  { tournamentBalance: { increment: returnAmount } },
        });
      } else {
        const field = trade.isDemo ? "demoBalance" : "balance";
        await tx.user.update({
          where: { id: trade.userId },
          data:  { [field]: { increment: returnAmount } },
        });
      }
    }
  });

  // Actualizar participantes de torneios — real ou demo conforme o tipo do trade
  if (resolved) {
    try {
      const participants = await prisma.tournamentParticipant.findMany({
        where: {
          userId: trade.userId,
          tournament: {
            status: "active",
            isDemo: trade.isDemo,
            endDate: { gte: trade.createdAt },
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
    const demoTag  = trade.isDemo ? " (Demo)" : "";

    // ── 1. Notificação in-app — sempre, demo e real ───────────────────────────
    prisma.notification.create({
      data: {
        userId:  trade.userId,
        type:    result === "win" ? "trade_win" : result === "draw" ? "trade_draw" : "trade_loss",
        title:   result === "win"  ? `Ganhou ${profitKz} Kz${demoTag}`
                : result === "draw" ? `Operação empatada — ${trade.asset}${demoTag}`
                : `Operação encerrada — ${trade.asset}${demoTag}`,
        message: result === "win"  ? `A tua operação de ${amountKz} Kz em ${trade.asset} foi resolvida a teu favor!`
                : result === "draw" ? `O preço não se mexeu em ${trade.asset} — o valor de ${amountKz} Kz foi devolvido.`
                : `Perdeste ${amountKz} Kz em ${trade.asset}. Analisa e tenta novamente.`,
        read: false,
      },
    }).catch(() => {});

    // ── 2. Push — sempre, demo e real ────────────────────────────────────────
    sendPushToUser(trade.userId, {
      title: result === "win"  ? `Ganhou ${profitKz} Kz${demoTag}`
           : result === "draw" ? `Operação empatada — ${trade.asset}`
           : `Operação perdida — ${trade.asset}`,
      body: result === "win"  ? `${trade.asset} · A operação foi resolvida a teu favor!`
          : result === "draw" ? `O preço não se mexeu — o valor de ${amountKz} Kz foi devolvido.`
          : `Perdeste ${amountKz} Kz. Continua a tentar!`,
      url:   "/trade",
      tag:   "trade-result",
    }).catch(() => {});

    // ── 3. Email — só para trades reais win/loss, throttle 4h (empates não enviam email) ──
    if (!trade.user.isDemo && result !== "draw") {
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
