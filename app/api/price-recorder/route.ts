import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CRYPTO_PAIRS } from "@/lib/derivWebSocket";

// Vercel: tempo máximo desta rota. Medido em produção com 16 pares (ver commit) —
// ajusta para cima se o plano/latência da Binance mudar. Hobby ignora/limita a 10s;
// Pro aceita este valor.
export const maxDuration = 30;

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

type CandleRow = {
  asset:     string;
  timeframe: string;
  timestamp: Date;
  open:      number;
  high:      number;
  low:       number;
  close:     number;
};

/**
 * Escreve todos os candles recolhidos numa ÚNICA instrução SQL (um round-trip
 * à BD, não um por par/timeframe/candle). Usa INSERT ... ON CONFLICT DO UPDATE
 * em vez de `createMany` porque `createMany` (com `skipDuplicates`) não
 * actualiza linhas já existentes — e a vela ainda "em formação" de cada
 * timeframe (sobretudo 5m/15m, cujo intervalo é maior que a cadência do cron
 * de 1 min) é reescrita várias vezes com valores de high/low/close cada vez
 * mais completos antes de fechar. Com `createMany` essa vela ficaria presa
 * no primeiro valor parcial gravado, em vez de acabar com o valor final
 * correcto — regressão silenciosa na qualidade dos dados dos gráficos.
 */
async function upsertCandlesBatch(rows: CandleRow[]): Promise<number> {
  if (rows.length === 0) return 0;

  const values = Prisma.join(
    rows.map(r => Prisma.sql`(${randomUUID()}, ${r.asset}, ${r.timeframe}, ${r.open}, ${r.high}, ${r.low}, ${r.close}, ${r.timestamp}, 0)`),
  );

  await prisma.$executeRaw`
    INSERT INTO "PriceCandle" (id, asset, timeframe, open, high, low, close, timestamp, volume)
    VALUES ${values}
    ON CONFLICT (asset, timeframe, timestamp)
    DO UPDATE SET open = EXCLUDED.open, high = EXCLUDED.high, low = EXCLUDED.low, close = EXCLUDED.close
  `;

  return rows.length;
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

  const startedAt = Date.now();

  // Todos os pares × todos os timeframes, em paralelo (com um pequeno
  // desfasamento entre pedidos para não disparar tudo no mesmo instante sobre
  // a Binance). Cada job é independente — a falha de um par/timeframe não
  // afecta os outros (Promise.allSettled).
  const jobs = CRYPTO_PAIRS.flatMap(pair => TIMEFRAMES.map(tf => ({ pair, tf })));

  const results = await Promise.allSettled(
    jobs.map(async ({ pair, tf }, idx) => {
      await delay(idx * 40);
      const candles = await fetchBinanceCandles(pair.symbol, tf.interval, 5);
      return candles.map((c): CandleRow => ({
        asset: pair.label, timeframe: tf.label, timestamp: new Date(c.epoch * 1000),
        open: c.open, high: c.high, low: c.low, close: c.close,
      }));
    })
  );

  const rows: CandleRow[] = [];
  const assets = new Set<string>();
  let fetchErrors = 0;

  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      if (r.value.length > 0) assets.add(jobs[i].pair.label);
      rows.push(...r.value);
    } else {
      fetchErrors++;
      console.error("[price-recorder]", jobs[i].pair.symbol, jobs[i].tf.label, r.reason);
    }
  });

  // Escrita em lote único — ver upsertCandlesBatch(). Se a execução for
  // cortada ANTES desta linha (timeout a meio da recolha), nada é escrito
  // nesta invocação: sem estado parcial. Ver nota sobre o cenário de corte
  // durante a própria escrita no commit/PR.
  const saved = await upsertCandlesBatch(rows);

  const elapsedMs = Date.now() - startedAt;
  return NextResponse.json({ saved, assets: [...assets], fetchErrors, elapsedMs });
}
