import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { settings } from "@/lib/settings";

const ALLOWED_ASSETS = [
  // Live forex
  "EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD",
  "USD/CAD", "EUR/GBP", "USD/CHF", "NZD/USD",
  // OTC after-hours
  "EUR/USD (OTC)", "GBP/USD (OTC)", "USD/JPY (OTC)",
  "AUD/USD (OTC)", "USD/CAD (OTC)", "EUR/GBP (OTC)",
  // Synthetic / Volatility (weekends)
  "Vol. 10", "Vol. 25", "Vol. 50", "Vol. 75", "Vol. 100",
  "Boom 300", "Crash 300",
];

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}

// Entry price is supplied by the client (from the live Deriv WS tick).
// The server uses it for record-keeping only; outcome is determined server-side.
function sanitizeEntryPrice(raw: unknown): number {
  const n = parseFloat(String(raw));
  return isFinite(n) && n > 0 ? n : 1.0;
}



export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";

  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "Demasiadas operações. Aguarde 1 minuto." }, { status: 429 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
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

  if (settings.maintenanceMode) {
    return NextResponse.json({ error: "Plataforma em manutenção. Tente novamente em breve." }, { status: 503 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: "Utilizador não encontrado" }, { status: 404 });
  if (user.status === "blocked") return NextResponse.json({ error: "Conta bloqueada" }, { status: 403 });

  const currentBalance = user.isDemo ? user.demoBalance : user.balance;
  if (currentBalance < amount) {
    return NextResponse.json({ error: "Saldo insuficiente" }, { status: 400 });
  }

  // Entry price comes from the client's live Deriv WS tick
  const entryPrice = sanitizeEntryPrice(rawEntryPrice);
  const payout = 0.85;

  // Deduct immediately
  if (user.isDemo) {
    await prisma.user.update({ where: { id: user.id }, data: { demoBalance: { decrement: amount } } });
  } else {
    await prisma.user.update({ where: { id: user.id }, data: { balance: { decrement: amount } } });
  }

  const trade = await prisma.trade.create({
    data: { userId: user.id, asset, direction, amount, entryPrice, payout, expirySecs, status: "active" },
  });

  // Schedule resolution — outcome determined server-side with house edge
  setTimeout(async () => {
    try {
      const winProb = settings.winProbability[asset] ?? 0.47;
      const result: "win" | "loss" = Math.random() < winProb ? "win" : "loss";
      const profit = result === "win" ? amount * payout : -amount;
      const returnAmount = result === "win" ? amount + amount * payout : 0;
      // Use entry price as close price placeholder (real price unavailable without WS on server)
      const closePrice = entryPrice * (1 + (Math.random() - 0.5) * 0.002);

      await prisma.trade.update({
        where: { id: trade.id },
        data: { closePrice, result, profit, status: "closed", closedAt: new Date() },
      });

      if (returnAmount > 0) {
        if (user.isDemo) {
          await prisma.user.update({ where: { id: user.id }, data: { demoBalance: { increment: returnAmount } } });
        } else {
          await prisma.user.update({ where: { id: user.id }, data: { balance: { increment: returnAmount } } });
        }
      }
    } catch (err) {
      console.error("Trade resolution error:", err);
    }
  }, expirySecs * 1000);

  return NextResponse.json({ trade, entryPrice });
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

  return NextResponse.json({ trades, total, page, totalPages: Math.ceil(total / limit) });
}
