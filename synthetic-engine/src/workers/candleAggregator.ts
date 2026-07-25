import { prisma } from "../lib/prisma";

// timeframes suportados e a sua duração em ms — "15m" incluído porque a
// plataforma principal (app/api/price-recorder/route.ts, lib/derivWebSocket.ts)
// pede candles em 1m/5m/15m, não 1h.
const TIMEFRAMES: Record<string, number> = {
  "1m":  60_000,
  "5m":  5 * 60_000,
  "15m": 15 * 60_000,
  "1h":  60 * 60_000,
};

/**
 * Agrega os SyntheticTick do último período fechado em SyntheticCandle,
 * para cada símbolo activo e cada timeframe suportado.
 * Deve correr num interval próprio (ver início em src/index.ts) — o timeframe
 * mais curto (1m) define a cadência mínima de execução.
 */
export async function aggregateCandles() {
  const indices = await prisma.syntheticIndex.findMany({ where: { active: true } });

  for (const index of indices) {
    for (const [timeframe, durationMs] of Object.entries(TIMEFRAMES)) {
      await aggregateOne(index.symbol, timeframe, durationMs);
    }
  }
}

async function aggregateOne(symbol: string, timeframe: string, durationMs: number) {
  const now = Date.now();
  // período fechado mais recente (evita agregar um candle ainda "a meio")
  const periodEnd = Math.floor(now / durationMs) * durationMs;
  const periodStart = periodEnd - durationMs;

  // já existe candle para este período? evita reprocessar
  const existing = await prisma.syntheticCandle.findUnique({
    where: {
      symbol_timeframe_timestamp: {
        symbol,
        timeframe,
        timestamp: new Date(periodStart),
      },
    },
  });
  if (existing) return;

  const ticks = await prisma.syntheticTick.findMany({
    where: {
      symbol,
      timestamp: { gte: new Date(periodStart), lt: new Date(periodEnd) },
    },
    orderBy: { timestamp: "asc" },
  });

  if (ticks.length === 0) return; // sem ticks neste período, nada a agregar

  const prices = ticks.map((t) => t.price);
  const open = prices[0];
  const close = prices[prices.length - 1];
  const high = Math.max(...prices);
  const low = Math.min(...prices);

  await prisma.syntheticCandle.create({
    data: {
      symbol,
      timeframe,
      open,
      high,
      low,
      close,
      timestamp: new Date(periodStart),
    },
  });
}

/** Inicia o job em loop, verificando a cada 30s (suficiente para o timeframe mínimo de 1m). */
export function startCandleAggregator() {
  setInterval(() => {
    aggregateCandles().catch((err) =>
      console.error("[candleAggregator] erro:", err)
    );
  }, 30_000);
  console.log("[candleAggregator] iniciado");
}
