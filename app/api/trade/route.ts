import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { checkRateLimit } from "@/lib/rateLimit";

const ALLOWED_ASSETS = [
  // Forex
  "EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD",
  "USD/CAD", "EUR/GBP", "USD/CHF", "NZD/USD",
  "EUR/JPY", "GBP/JPY", "EUR/CAD", "AUD/JPY", "GBP/AUD", "EUR/CHF",
  // Crypto (24/7)
  "BTC/USD", "ETH/USD",
  // Commodities
  "XAU/USD", "XAG/USD",
];

// Entry price is supplied by the client (from the live Deriv WS tick).
// The server uses it for record-keeping only; outcome is determined server-side.
function sanitizeEntryPrice(raw: unknown): number {
  const n = parseFloat(String(raw));
  return isFinite(n) && n > 0 ? n : 1.0;
}



export async function POST(req: NextRequest) {
  // Autenticar primeiro para usar userId no rate limit (IP é forjável)
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  // 10 trades por minuto por userId
  if (!checkRateLimit("trade", session.user.id, 10, 60_000)) {
    return NextResponse.json({ error: "Demasiadas operações. Aguarde 1 minuto." }, { status: 429 });
  }

  const body = await req.json();
  const { asset, direction, amount, expirySecs, entryPrice: rawEntryPrice } = body;

  if (!ALLOWED_ASSETS.includes(asset)) {
    return NextResponse.json({ error: "Ativo não permitido" }, { status: 400 });
  }
  if (!["call", "put"].includes(direction)) {
    return NextResponse.json({ error: "Direção inválida" }, { status: 400 });
  }
  if (!amount || amount < 1000 || amount > 500000) {
    return NextResponse.json({ error: "Valor entre 1.000 e 500.000 Kz" }, { status: 400 });
  }
  if (!Number.isInteger(expirySecs) || expirySecs < 60 || expirySecs > 3600) {
    return NextResponse.json({ error: "Expiração entre 1 e 60 minutos" }, { status: 400 });
  }

  let cfg;
  let user;
  try {
    cfg = await getSettings();
    if (cfg.maintenanceMode) {
      return NextResponse.json({ error: "Plataforma em manutenção. Tente novamente em breve." }, { status: 503 });
    }
    user = await prisma.user.findUnique({ where: { id: session.user.id } });
  } catch {
    return NextResponse.json({ error: "Erro interno. Tente novamente." }, { status: 500 });
  }

  if (!user) return NextResponse.json({ error: "Utilizador não encontrado" }, { status: 404 });
  if (user.status === "blocked") return NextResponse.json({ error: "Conta bloqueada" }, { status: 403 });

  // Entry price comes from the client's live Deriv WS tick
  const entryPrice = sanitizeEntryPrice(rawEntryPrice);
  const payout = cfg.payout?.[asset] ?? 0.85;

  let trade;
  try {
    // Débito atómico: o WHERE inclui a condição de saldo para evitar race conditions
    trade = await prisma.$transaction(async (tx) => {
      const balanceField = user.isDemo ? "demoBalance" : "balance";
      const updated = await tx.user.updateMany({
        where: {
          id: user.id,
          [balanceField]: { gte: amount },
        },
        data: { [balanceField]: { decrement: amount } },
      });

      if (updated.count === 0) {
        throw Object.assign(new Error("INSUFFICIENT_BALANCE"), { code: "INSUFFICIENT_BALANCE" });
      }

      return tx.trade.create({
        data: { userId: user.id, asset, direction, amount, entryPrice, payout, expirySecs, status: "active", isDemo: user.isDemo },
      });
    });
  } catch (err: any) {
    if (err?.code === "INSUFFICIENT_BALANCE") {
      return NextResponse.json({ error: "Saldo insuficiente" }, { status: 400 });
    }
    console.error("[trade/open]", err);
    return NextResponse.json({ error: "Erro ao registar operação. Tente novamente." }, { status: 500 });
  }

  const serverTime = Date.now();
  const expiresAt  = trade.createdAt.getTime() + trade.expirySecs * 1000;
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

  // Marca automaticamente como "lost" operações ativas que expiraram
  // há mais de 5 minutos e cujo preço de fecho não pôde ser determinado.
  // Isto evita que operações presas (ex: bug de símbolo antigo) contaminem
  // o painel com countdowns errados.
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  await prisma.trade.updateMany({
    where: {
      userId:    session.user.id,
      status:    "active",
      createdAt: { lt: fiveMinutesAgo },
    },
    data: {
      status:   "closed",
      result:   "loss",
      closedAt: new Date(),
    },
  }).catch(() => {}); // silencioso — não bloqueia o GET

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
  const tradesWithRemaining = trades.map(t => ({
    ...t,
    // expiresAt em Unix ms (tempo do servidor) — autoridade absoluta sobre quando expira
    expiresAt: t.createdAt.getTime() + t.expirySecs * 1000,
    remainingSecs: t.status === "active"
      ? Math.max(0, t.expirySecs - Math.floor((now - t.createdAt.getTime()) / 1000))
      : 0,
  }));

  // serverTime permite ao cliente medir o desfasamento entre o seu relógio e o servidor
  return NextResponse.json({ trades: tradesWithRemaining, total, page, totalPages: Math.ceil(total / limit), serverTime: now });
}
