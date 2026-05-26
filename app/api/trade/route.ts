import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { checkRateLimit } from "@/lib/rateLimit";
import { getDerivPrice, isOtcAsset } from "@/lib/derivPrice";
import { sendPushToUser } from "@/lib/webPush";

const ALLOWED_ASSETS = new Set([
  // Forex real
  "EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CAD", "EUR/GBP",
  "USD/CHF", "NZD/USD", "EUR/JPY", "GBP/JPY", "EUR/CAD", "AUD/JPY",
  "GBP/AUD", "EUR/CHF", "AUD/CAD", "AUD/CHF", "AUD/NZD", "EUR/AUD",
  "EUR/NZD", "GBP/CAD", "GBP/CHF", "GBP/NOK", "GBP/NZD", "NZD/JPY",
  "USD/MXN", "USD/NOK", "USD/PLN", "USD/SEK",
  // Cripto + Metais (sem XAU/USD)
  "BTC/USD", "ETH/USD",
  "Prata/USD", "Paládio/USD", "Platina/USD",
  "XAG/USD",
  // Pares sintéticos OTC (índices Deriv 24/7)
  "EUR/USD OTC", "GBP/USD OTC", "USD/JPY OTC", "AUD/USD OTC", "USD/CAD OTC",
  "EUR/GBP OTC", "USD/CHF OTC", "NZD/USD OTC", "EUR/JPY OTC", "GBP/JPY OTC",
]);

// Símbolos sintéticos válidos (índices Deriv 24/7)
const SYNTHETIC_SYMBOLS = new Set([
  "1HZ10V", "1HZ25V", "1HZ50V", "1HZ75V", "1HZ100V",
  "R_10", "R_25", "R_50", "R_75", "R_100",
]);

async function fetchServerEntryPrice(asset: string, isSynthetic: boolean): Promise<number | null> {
  // 1. Try PriceCandle DB (recorded in the last 30s by price-recorder)
  try {
    const cutoff = new Date(Date.now() - 30_000);
    const candle = await prisma.priceCandle.findFirst({
      where:   { asset, timestamp: { gte: cutoff } },
      orderBy: { timestamp: "desc" },
      select:  { close: true },
    });
    if (candle?.close && candle.close > 0) return candle.close;
  } catch { /* DB unavailable — fall through to WS */ }

  // 2. Fallback: live Deriv WS tick
  // forceReal=true apenas para pares reais — sintéticos usam sempre o índice Deriv
  return getDerivPrice(asset, !isSynthetic);
}



export async function POST(req: NextRequest) {
  let session: any;
  try {
    session = await auth();
  } catch (err) {
    console.error("[trade/open] auth()", err);
    return NextResponse.json({ error: "Erro de autenticação." }, { status: 500 });
  }
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const cfg = await getSettings().catch(() => null);
  const { maintenanceMode, forceRealMarket } = cfg ?? { maintenanceMode: false, forceRealMarket: false };
  if (maintenanceMode) {
    return NextResponse.json({ error: "Plataforma em manutenção. Tenta mais tarde." }, { status: 503 });
  }

  if (!await checkRateLimit("trade", session.user.id, 10, 60_000)) {
    return NextResponse.json({ error: "Demasiadas operações. Aguarde 1 minuto." }, { status: 429 });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const { asset, symbol, direction, amount, expirySecs, skipTournament } = body ?? {};
  const isSynthetic = typeof symbol === "string" && SYNTHETIC_SYMBOLS.has(symbol);

  if (!ALLOWED_ASSETS.has(asset)) {
    return NextResponse.json({ error: "Ativo não permitido" }, { status: 400 });
  }
  if (!["call", "put"].includes(direction)) {
    return NextResponse.json({ error: "Direção inválida" }, { status: 400 });
  }
  const amountNum = Number(amount);
  if (!amountNum || amountNum < 1000 || amountNum > 500000) {
    return NextResponse.json({ error: "Valor entre 1.000 e 500.000 Kz" }, { status: 400 });
  }
  const expiry = Number(expirySecs);
  if (!Number.isInteger(expiry) || expiry < 30 || expiry > 3600) {
    return NextResponse.json({ error: "Expiração entre 30 segundos e 60 minutos" }, { status: 400 });
  }

  // Buscar utilizador
  let user: any;
  try {
    user = await prisma.user.findUnique({ where: { id: session.user.id } });
  } catch (err) {
    console.error("[trade/open] findUser", err);
    return NextResponse.json({ error: "Erro de ligação. Tente novamente." }, { status: 500 });
  }

  if (!user) return NextResponse.json({ error: "Utilizador não encontrado" }, { status: 404 });
  if (user.status === "blocked") return NextResponse.json({ error: "Conta bloqueada" }, { status: 403 });

  // Conta real exige pelo menos 1 depósito aprovado
  if (!user.isDemo) {
    const hasDeposit = await prisma.transaction.findFirst({
      where: { userId: user.id, type: "deposit", status: "completed" },
      select: { id: true },
    });
    if (!hasDeposit) {
      return NextResponse.json({
        error: "Para operar em conta real é necessário efectuar um depósito primeiro.",
      }, { status: 403 });
    }
  }

  // Verificar se utilizador está inscrito em torneio activo — respeita escolha de conta do utilizador
  const activeTournamentParticipant = skipTournament ? null : await prisma.tournamentParticipant.findFirst({
    where: {
      userId: user.id,
      tournament: { status: "active", isDemo: user.isDemo, endDate: { gte: new Date() } },
    },
    include: { tournament: { select: { id: true, startingBalance: true } } },
  });

  const isTournamentTrade = !!activeTournamentParticipant;

  // Saldo a usar: torneio > demo > real
  let currentBalance: number;
  if (isTournamentTrade) {
    currentBalance = activeTournamentParticipant!.tournamentBalance;
  } else {
    const balanceField = user.isDemo ? "demoBalance" : "balance";
    currentBalance = user[balanceField] ?? 0;
  }

  if (currentBalance < amountNum) {
    return NextResponse.json({
      error: isTournamentTrade ? "Saldo do torneio insuficiente" : "Saldo insuficiente",
    }, { status: 400 });
  }

  // Limite diário de perda (apenas conta real, fora de torneio)
  const dailyLossLimitPct = cfg?.dailyLossLimitPct ?? 0;
  if (!user.isDemo && !isTournamentTrade && dailyLossLimitPct > 0) {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayLosses = await prisma.trade.aggregate({
      where: { userId: user.id, isDemo: false, status: "lost", createdAt: { gte: todayStart } },
      _sum: { amount: true },
    });
    const lostToday = todayLosses._sum.amount ?? 0;
    const startBal  = currentBalance + lostToday;
    const maxLoss   = startBal * (dailyLossLimitPct / 100);
    if (lostToday >= maxLoss) {
      return NextResponse.json({
        error: `Limite diário de perda atingido (${dailyLossLimitPct}%). Tente amanhã.`,
      }, { status: 403 });
    }
  }

  // Obter payout das definições (com fallback)
  const payout = cfg?.payout?.[asset] ?? 0.85;

  // Entry price: symbol do cliente validado contra lista de sintéticos conhecidos
  // isSynthetic determina a fonte do preço (índice vs par real) — o preço vem sempre do servidor
  let entryPrice = await fetchServerEntryPrice(asset, isSynthetic);
  if (!entryPrice) {
    const clientPrice = Number(body?.entryPrice);
    if (clientPrice > 0) entryPrice = clientPrice;
  }
  if (!entryPrice) {
    return NextResponse.json(
      { error: "Preço de mercado indisponível. Tente novamente em instantes." },
      { status: 503 },
    );
  }

  // Débito atómico
  let deducted: any;
  try {
    if (isTournamentTrade) {
      deducted = await prisma.tournamentParticipant.updateMany({
        where: { id: activeTournamentParticipant!.id, tournamentBalance: { gte: amountNum } },
        data:  { tournamentBalance: { decrement: amountNum } },
      });
    } else {
      const balanceField = user.isDemo ? "demoBalance" : "balance";
      deducted = await prisma.user.updateMany({
        where: { id: user.id, [balanceField]: { gte: amountNum } },
        data:  { [balanceField]: { decrement: amountNum } },
      });
    }
  } catch (err) {
    console.error("[trade/open] deduct", err);
    return NextResponse.json({ error: "Erro ao processar saldo. Tente novamente." }, { status: 500 });
  }

  if (deducted.count === 0) {
    return NextResponse.json({ error: "Saldo insuficiente" }, { status: 400 });
  }

  // Criar operação
  let trade: any;
  try {
    const expiresAt = new Date(Date.now() + expiry * 1000);
    trade = await prisma.trade.create({
      data: {
        userId: user.id, asset, symbol: typeof symbol === "string" ? symbol : null, direction,
        amount: amountNum, entryPrice, payout,
        expirySecs: expiry, expiresAt, status: "active", isDemo: user.isDemo,
        tournamentParticipantId: isTournamentTrade ? activeTournamentParticipant!.id : null,
      },
    });
  } catch (err) {
    console.error("[trade/open] create", err);
    // Reembolsar saldo se a criação falhou
    if (isTournamentTrade) {
      await prisma.tournamentParticipant.update({
        where: { id: activeTournamentParticipant!.id },
        data:  { tournamentBalance: { increment: amountNum } },
      }).catch(() => {});
    } else {
      const bf = user.isDemo ? "demoBalance" : "balance";
      await prisma.user.update({
        where: { id: user.id },
        data:  { [bf]: { increment: amountNum } },
      }).catch(() => {});
    }
    return NextResponse.json({ error: "Erro ao registar operação. Tente novamente." }, { status: 500 });
  }

  // Notificar admins se operação real acima do threshold configurado
  const largeTradePushThreshold = cfg?.largeTradePushThreshold ?? 0;
  if (!user.isDemo && largeTradePushThreshold > 0 && amountNum >= largeTradePushThreshold) {
    prisma.user.findMany({ where: { role: "admin" }, select: { id: true } }).then(admins => {
      const kzFormatted = amountNum.toLocaleString("pt-PT") + " Kz";
      admins.forEach(a => sendPushToUser(a.id, {
        title: "💰 Operação grande aberta",
        body:  `${user.name ?? user.email} abriu ${kzFormatted} em ${asset} (${direction.toUpperCase()})`,
        url:   "/ao/admin/live",
        tag:   "large-trade",
      }).catch(() => {}));
    }).catch(() => {});
  }

  const serverTime = Date.now();
  const expiresAt  = trade.expiresAt.getTime();
  return NextResponse.json({ trade: { ...trade, expiresAt }, entryPrice, serverTime });
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page  = Math.max(1, parseInt(searchParams.get("page")  ?? "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));
  const skip  = (page - 1) * limit;

  const [trades, total] = await Promise.all([
    prisma.trade.findMany({
      where:   { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.trade.count({ where: { userId: session.user.id } }),
  ]);

  const now = Date.now();
  const tradesWithRemaining = trades.map(t => {
    const expiresAtMs = t.expiresAt ? t.expiresAt.getTime() : t.createdAt.getTime() + t.expirySecs * 1000;
    return {
      ...t,
      expiresAt: expiresAtMs,
      remainingSecs: t.status === "active" ? Math.max(0, Math.floor((expiresAtMs - now) / 1000)) : 0,
    };
  });

  // serverTime permite ao cliente medir o desfasamento entre o seu relógio e o servidor
  return NextResponse.json({ trades: tradesWithRemaining, total, page, totalPages: Math.ceil(total / limit), serverTime: now });
}
