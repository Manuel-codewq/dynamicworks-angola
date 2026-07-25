import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CRYPTO_PAIRS } from "@/lib/derivWebSocket";

// Vercel: tempo máximo desta rota. Plano Pro confirmado (tecto 300s) — este
// job é um batch rápido (4 pares × 3 timeframes contra o synthetic-engine,
// rede interna, tipicamente <2s), não precisa de se aproximar do tecto como
// app/api/price-stream/route.ts (que mantém uma ligação SSE longa por
// natureza) — 30s já dá margem generosa.
export const maxDuration = 30;

const SYNTHETIC_ENGINE_URL = process.env.SYNTHETIC_ENGINE_URL ?? "http://localhost:4001";

const TIMEFRAMES = [
  { label: "1m",  granularity: 60  },
  { label: "5m",  granularity: 300 },
  { label: "15m", granularity: 900 },
];

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// NOTA: depende de synthetic-engine agregar SyntheticTick em SyntheticCandle
// por timeframe (5m/15m incluído) — se esse job de agregação ainda não
// existir do lado do synthetic-engine, este endpoint devolve [] em silêncio
// (não é erro nosso, PriceCandle só fica sem dados novos até isso existir).
async function fetchSyntheticCandles(symbol: string, timeframe: string, limit = 5) {
  const url = `${SYNTHETIC_ENGINE_URL}/api/indices/${symbol}/candles?timeframe=${timeframe}&limit=${limit}`;
  const res  = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`synthetic-engine ${symbol} ${timeframe}: HTTP ${res.status}`);
  const rows = await res.json() as { open: number; high: number; low: number; close: number; timestamp: string }[];
  return rows.map(c => ({
    epoch: Math.floor(new Date(c.timestamp).getTime() / 1000),
    open:  c.open,
    high:  c.high,
    low:   c.low,
    close: c.close,
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
  // o synthetic-engine). Cada job é independente — a falha de um par/timeframe
  // não afecta os outros (Promise.allSettled).
  const jobs = CRYPTO_PAIRS.flatMap(pair => TIMEFRAMES.map(tf => ({ pair, tf })));

  const results = await Promise.allSettled(
    jobs.map(async ({ pair, tf }, idx) => {
      await delay(idx * 40);
      const candles = await fetchSyntheticCandles(pair.symbol, tf.label, 5);
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
