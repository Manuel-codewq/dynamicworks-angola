import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DerivWSClient, type DerivCandle } from "@/lib/derivServerWS";

const FOREX_PAIRS = [
  { asset: "EUR/USD", symbol: "frxEURUSD" },
  { asset: "GBP/USD", symbol: "frxGBPUSD" },
  { asset: "USD/JPY", symbol: "frxUSDJPY" },
  { asset: "AUD/USD", symbol: "frxAUDUSD" },
  { asset: "USD/CAD", symbol: "frxUSDCAD" },
  { asset: "EUR/GBP", symbol: "frxEURGBP" },
  { asset: "USD/CHF", symbol: "frxUSDCHF" },
  { asset: "NZD/USD", symbol: "frxNZDUSD" },
  { asset: "EUR/JPY", symbol: "frxEURJPY" },
  { asset: "GBP/JPY", symbol: "frxGBPJPY" },
  { asset: "EUR/CAD", symbol: "frxEURCAD" },
  { asset: "AUD/JPY", symbol: "frxAUDJPY" },
  { asset: "GBP/AUD", symbol: "frxGBPAUD" },
  { asset: "EUR/CHF", symbol: "frxEURCHF" },
];

// Crypto, commodities e sintéticos — disponíveis 24/7
const ALWAYS_ON_PAIRS = [
  { asset: "BTC/USD",       symbol: "cryBTCUSD"  },
  { asset: "ETH/USD",       symbol: "cryETHUSD"  },
  { asset: "Prata/USD",     symbol: "frxXAGUSD"  },
  { asset: "Paládio/USD",   symbol: "frxXPDUSD"  },
  { asset: "Platina/USD",   symbol: "frxXPTUSD"  },
  // Sintéticos OTC — todos os 17 confirmados (labels exactos do UI)
  { asset: "EUR/USD OTC",   symbol: "1HZ10V"  },
  { asset: "GBP/USD OTC",   symbol: "1HZ25V"  },
  { asset: "USD/JPY OTC",   symbol: "1HZ50V"  },
  { asset: "AUD/USD OTC",   symbol: "1HZ75V"  },
  { asset: "USD/CAD OTC",   symbol: "1HZ100V" },
  { asset: "EUR/GBP OTC",   symbol: "R_10"    },
  { asset: "USD/CHF OTC",   symbol: "R_25"    },
  { asset: "NZD/USD OTC",   symbol: "R_50"    },
  { asset: "EUR/JPY OTC",   symbol: "R_75"    },
  { asset: "GBP/JPY OTC",   symbol: "R_100"   },
  { asset: "EUR/CHF OTC",   symbol: "RDBEAR"  },
  { asset: "AUD/CHF OTC",   symbol: "RDBULL"  },
  { asset: "AUD/JPY OTC",   symbol: "WLDAUD"  },
  { asset: "EUR/CAD OTC",   symbol: "WLDEUR"  },
  { asset: "GBP/CAD OTC",   symbol: "WLDGBP"  },
  { asset: "USD/MXN OTC",   symbol: "WLDUSD"  },
  { asset: "Ouro/USD OTC",  symbol: "WLDXAU"  },
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

async function recordPairs(
  client: DerivWSClient,
  pairList: { asset: string; symbol: string }[],
  saved: { count: number },
  assets: string[],
) {
  for (const tf of TIMEFRAMES) {
    const results = await Promise.allSettled(
      pairList.map(async (pair, idx) => {
        await delay(idx * 200);
        const candles = await client.fetchCandles(pair.symbol, tf.granularity, 5);
        const upserts = await Promise.allSettled(
          candles.map(c => {
            const ts    = new Date(Number(c.epoch) * 1000);
            const open  = Number(c.open);
            const high  = Number(c.high);
            const low   = Number(c.low);
            const close = Number(c.close);
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
      if (r.status === "fulfilled") saved.count += r.value;
      else console.error("[price-recorder]", r.reason);
    }
  }
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

  const saved  = { count: 0 };
  const assets: string[] = [];

  const client = new DerivWSClient();
  try {
    await client.connect();

    // Always record crypto and commodities (24/7 markets)
    await recordPairs(client, ALWAYS_ON_PAIRS, saved, assets);

    // Only record forex during market hours
    if (isMarketOpen()) {
      await recordPairs(client, FOREX_PAIRS, saved, assets);
    }
  } finally {
    client.close();
  }

  return NextResponse.json({ saved: saved.count, assets });
}
