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

  if (!checkRateLimit("trade", session.user.id, 10, 60_000)) {
    return NextResponse.json({ error: "Demasiadas operações. Aguarde 1 minuto." }, { status: 429 });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const { asset, direction, amount, expirySecs, entryPrice: rawEntryPrice } = body ?? {};

  if (!ALLOWED_ASSETS.includes(asset)) {
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
  if (!Number.isInteger(expiry) || expiry < 60 || expiry > 3600) {
    return NextResponse.json({ error: "Expiração entre 1 e 60 minutos" }, { status: 400 });
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

  const balanceField = user.isDemo ? "demoBalance" : "balance";
  const currentBalance: number = user[balanceField] ?? 0;
  if (currentBalance < amountNum) {
    return NextResponse.json({ error: "Saldo insuficiente" }, { status: 400 });
  }

  // Obter payout das definições (com fallback)
  const cfg = await getSettings().catch(() => null);
  const payout = cfg?.payout?.[asset] ?? 0.85;
  const entryPrice = sanitizeEntryPrice(rawEntryPrice);

  // Débito atómico: WHERE garante que saldo não ficou negativo entre a verificação e o débito
  let deducted: any;
  try {
    deducted = await prisma.user.updateMany({
      where: { id: user.id, [balanceField]: { gte: amountNum } },
      data:  { [balanceField]: { decrement: amountNum } },
    });
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
    trade = await prisma.trade.create({
      data: {
        userId: user.id, asset, direction,
        amount: amountNum, entryPrice, payout,
        expirySecs: expiry, status: "active", isDemo: user.isDemo,
      },
    });
  } catch (err) {
    console.error("[trade/open] create", err);
    // Reembolsar saldo se a criação falhou
    await prisma.user.update({
      where: { id: user.id },
      data:  { [balanceField]: { increment: amountNum } },
    }).catch(() => {});
    return NextResponse.json({ error: "Erro ao registar operação. Tente novamente." }, { status: 500 });
  }

  const serverTime = Date.now();
  const expiresAt  = new Date(trade.createdAt).getTime() + expiry * 1000;
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
