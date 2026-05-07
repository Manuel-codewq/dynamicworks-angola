import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const FOREX_PAIRS = [
  { asset: "EUR/USD", symbol: "frxEURUSD" },
  { asset: "GBP/USD", symbol: "frxGBPUSD" },
  { asset: "USD/JPY", symbol: "frxUSDJPY" },
  { asset: "AUD/USD", symbol: "frxAUDUSD" },
  { asset: "USD/CAD", symbol: "frxUSDCAD" },
  { asset: "EUR/GBP", symbol: "frxEURGBP" },
  { asset: "USD/CHF", symbol: "frxUSDCHF" },
  { asset: "NZD/USD", symbol: "frxNZDUSD" },
];

const TIMEFRAMES = [
  { label: "1m",  granularity: 60  },
  { label: "5m",  granularity: 300 },
  { label: "15m", granularity: 900 },
];

function isMarketOpen(): boolean {
  const now  = new Date();
  const day  = now.getUTCDay();   // 0=Sun, 6=Sat
  const hour = now.getUTCHours();
  if (day === 0 || day === 6) return false;
  return hour >= 6 && hour < 17;
}

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

interface DerivCandle {
  epoch: number;
  open:  string | number;
  high:  string | number;
  low:   string | number;
  close: string | number;
}

async function fetchDerivCandles(
  symbol: string,
  granularity: number,
  count = 5,
): Promise<DerivCandle[]> {
  const url =
    `https://api.deriv.com/api/v1/ticks_history` +
    `?ticks_history=${symbol}&count=${count}&end=latest&style=candles&granularity=${granularity}`;

  const res = await fetch(url, {
    headers: { "Accept": "application/json" },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status} for ${symbol}`);

  const json = await res.json();

  // Deriv response: { candles: [...] }
  const candles: DerivCandle[] = json?.candles ?? json?.history?.candles ?? [];
  return candles;
}

export async function GET() {
  if (!isMarketOpen()) {
    return NextResponse.json({ skipped: true, reason: "market closed" });
  }

  let saved   = 0;
  const assets: string[] = [];

  for (const tf of TIMEFRAMES) {
    const results = await Promise.allSettled(
      FOREX_PAIRS.map(async (pair, idx) => {
        // Stagger requests to avoid rate limits
        await delay(idx * 200);

        const candles = await fetchDerivCandles(pair.symbol, tf.granularity, 5);

        const upserts = await Promise.allSettled(
          candles.map(c => {
            const ts        = new Date(Number(c.epoch) * 1000);
            const open      = Number(c.open);
            const high      = Number(c.high);
            const low       = Number(c.low);
            const close     = Number(c.close);
            if (!isFinite(open) || !isFinite(close)) return Promise.resolve(null);

            return prisma.priceCandle.upsert({
              where:  { asset_timeframe_timestamp: { asset: pair.asset, timeframe: tf.label, timestamp: ts } },
              update: { open, high, low, close },
              create: { asset: pair.asset, timeframe: tf.label, timestamp: ts, open, high, low, close },
            });
          })
        );

        const ok = upserts.filter(r => r.status === "fulfilled" && r.value !== null).length;
        if (ok > 0 && !assets.includes(pair.asset)) assets.push(pair.asset);
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
