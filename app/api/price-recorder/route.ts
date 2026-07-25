import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CRYPTO_PAIRS } from "@/lib/derivWebSocket";

const BINANCE_REST = "https://api.binance.com/api/v3";

const TIMEFRAMES = [
  { label: "1m",  interval: "1m",  granularity: 60  },
  { label: "5m",  interval: "5m",  granularity: 300 },
  { label: "15m", interval: "15m", granularity: 900 },
];

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

async function fetchBinanceCandles(symbol: string, interval: string, limit = 5) {
  const url = `${BINANCE_REST}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res  = await fetch(url);
  if (!res.ok) throw new Error(`Binance ${symbol} ${interval}: HTTP ${res.status}`);
  const rows: any[][] = await res.json();
  return rows.map(k => ({
    epoch: Math.floor(Number(k[0]) / 1000),
    open:  parseFloat(k[1]),
    high:  parseFloat(k[2]),
    low:   parseFloat(k[3]),
    close: parseFloat(k[4]),
  })).filter(c => isFinite(c.open) && isFinite(c.close) && c.high >= c.low);
}

function isAuthorized(req: NextRequest): boolean {
  const workerSecret = process.env.WORKER_SECRET;
  const cronSecret   = process.env.CRON_SECRET;
  const xWorker      = req.headers.get("x-worker-secret");
  const auth         = req.headers.get("authorization");
  if (workerSecret && xWorker === workerSecret) return true;
  if (cronSecret   && auth   === `Bearer ${cronSecret}`) return true;
  if (workerSecret && auth   === `Bearer ${workerSecret}`) return true;
  return false;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  // Sem pares configurados (lib/assets.ts:ASSETS vazio) — nada a gravar.
  // Termina cedo e em silêncio, em vez de percorrer TIMEFRAMES sem trabalho real.
  if (CRYPTO_PAIRS.length === 0) {
    return NextResponse.json({ saved: 0, assets: [] });
  }

  let saved = 0;
  const assets: string[] = [];

  for (const tf of TIMEFRAMES) {
    const results = await Promise.allSettled(
      CRYPTO_PAIRS.map(async (pair, idx) => {
        await delay(idx * 100);
        const candles = await fetchBinanceCandles(pair.symbol, tf.interval, 5);
        const upserts = await Promise.allSettled(
          candles.map(c => {
            const ts = new Date(c.epoch * 1000);
            return prisma.priceCandle.upsert({
              where:  { asset_timeframe_timestamp: { asset: pair.label, timeframe: tf.label, timestamp: ts } },
              update: { open: c.open, high: c.high, low: c.low, close: c.close },
              create: { asset: pair.label, timeframe: tf.label, timestamp: ts, open: c.open, high: c.high, low: c.low, close: c.close },
            });
          })
        );
        const ok = upserts.filter(r => r.status === "fulfilled").length;
        if (ok > 0 && !assets.includes(pair.label)) assets.push(pair.label);
        return ok;
      })
    );
    for (const r of results) {
      if (r.status === "fulfilled") saved += r.value;
      else console.error("[price-recorder]", r.reason);
    }
  }

  return NextResponse.json({ saved, assets });
}
