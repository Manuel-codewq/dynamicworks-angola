import type { SyntheticIndex } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { computeNextPrice } from "./tickEngine";

// Quanto histórico gerar num arranque "a frio" (sem candles nenhuns ainda).
// 24h chega para o gráfico nascer com contexto em qualquer timeframe (1h dá
// 24 velas, 1m dá 1440) sem tornar o arranque lento.
const LOOKBACK_MS = 24 * 60 * 60_000;

// "1m" é a unidade base — as restantes timeframes são SEMPRE derivadas dela
// (agregando os candles de 1m já gerados), nunca geradas com um random walk
// independente. Gerar cada timeframe de forma independente produziria dados
// incoerentes entre si (ex: o candle de 1h não bateria certo com os 60
// candles de 1m correspondentes), o que ficaria visivelmente errado ao
// utilizador trocar de timeframe no gráfico.
const BASE_TIMEFRAME = "1m";
const BASE_DURATION_MS = 60_000;
const DERIVED_TIMEFRAMES: { label: string; durationMs: number }[] = [
  { label: "5m", durationMs: 5 * 60_000 },
  { label: "15m", durationMs: 15 * 60_000 },
  { label: "1h", durationMs: 60 * 60_000 },
];

// Sub-amostras dentro de cada candle de 1m, só para dar high/low realistas
// (em vez de high=low=open=close, que ficaria com aspecto claramente
// artificial no gráfico).
const SUB_TICKS_PER_CANDLE = 6;

type Candle = {
  symbol: string;
  timeframe: string;
  open: number;
  high: number;
  low: number;
  close: number;
  timestamp: Date;
};

function generateBaseCandles(index: SyntheticIndex, windowStartMs: number, windowEndMs: number): Candle[] {
  const candles: Candle[] = [];
  let price = index.basePrice;
  // Momento contínuo ao longo de toda a série gerada — mesma suavização
  // usada pelos ticks em tempo real (ver tickEngine.ts), para o histórico
  // sintético não parecer mais "nervoso" que os ticks ao vivo que se seguem.
  let momentum = 0;

  const firstPeriodStart = Math.floor(windowStartMs / BASE_DURATION_MS) * BASE_DURATION_MS;
  const lastPeriodStart = Math.floor(windowEndMs / BASE_DURATION_MS) * BASE_DURATION_MS - BASE_DURATION_MS; // último período já fechado

  for (let t = firstPeriodStart; t <= lastPeriodStart; t += BASE_DURATION_MS) {
    const open = price;
    let high = open;
    let low = open;

    for (let i = 0; i < SUB_TICKS_PER_CANDLE; i++) {
      const result = computeNextPrice({ ...index, lastPrice: price }, momentum);
      price = result.price;
      momentum = result.momentum;
      if (price > high) high = price;
      if (price < low) low = price;
    }

    candles.push({
      symbol: index.symbol,
      timeframe: BASE_TIMEFRAME,
      open,
      high,
      low,
      close: price,
      timestamp: new Date(t),
    });
  }

  return candles;
}

function deriveCandles(baseCandles: Candle[], label: string, durationMs: number): Candle[] {
  const buckets = new Map<number, Candle[]>();
  for (const c of baseCandles) {
    const bucketStart = Math.floor(c.timestamp.getTime() / durationMs) * durationMs;
    if (!buckets.has(bucketStart)) buckets.set(bucketStart, []);
    buckets.get(bucketStart)!.push(c);
  }

  const expectedCount = durationMs / BASE_DURATION_MS;
  const result: Candle[] = [];

  for (const [bucketStart, group] of buckets) {
    // Só buckets completos — evita gerar, por exemplo, um candle "1h" feito
    // só de 12 minutos porque a janela de backfill começou a meio de uma hora.
    if (group.length < expectedCount) continue;
    group.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    result.push({
      symbol: group[0].symbol,
      timeframe: label,
      open: group[0].open,
      close: group[group.length - 1].close,
      high: Math.max(...group.map((g) => g.high)),
      low: Math.min(...group.map((g) => g.low)),
      timestamp: new Date(bucketStart),
    });
  }

  return result;
}

async function insertBatch(candles: Candle[]) {
  const BATCH_SIZE = 1000;
  for (let i = 0; i < candles.length; i += BATCH_SIZE) {
    await prisma.syntheticCandle.createMany({
      data: candles.slice(i, i + BATCH_SIZE),
      skipDuplicates: true,
    });
  }
}

async function backfillSymbol(index: SyntheticIndex) {
  // Se já existem candles de 1m para este símbolo, não sabemos reconstruir a
  // mesma série (podem já vir de ticks reais, não deste backfill) — não
  // arriscar gerar 5m/15m/1h desalinhados com o 1m real já existente.
  const existingBase = await prisma.syntheticCandle.findFirst({
    where: { symbol: index.symbol, timeframe: BASE_TIMEFRAME },
    select: { id: true },
  });
  if (existingBase) {
    console.log(`[historicalBackfill] ${index.symbol} já tem candles de ${BASE_TIMEFRAME} — salta`);
    return;
  }

  const now = Date.now();
  const baseCandles = generateBaseCandles(index, now - LOOKBACK_MS, now);
  if (baseCandles.length === 0) return;

  await insertBatch(baseCandles);
  console.log(`[historicalBackfill] ${index.symbol}: ${baseCandles.length} candles de ${BASE_TIMEFRAME} gerados`);

  for (const tf of DERIVED_TIMEFRAMES) {
    const existingDerived = await prisma.syntheticCandle.findFirst({
      where: { symbol: index.symbol, timeframe: tf.label },
      select: { id: true },
    });
    if (existingDerived) continue;

    const derived = deriveCandles(baseCandles, tf.label, tf.durationMs);
    if (derived.length === 0) continue;
    await insertBatch(derived);
    console.log(`[historicalBackfill] ${index.symbol}: ${derived.length} candles de ${tf.label} derivados`);
  }

  // O preço ao vivo continua a partir daqui — sem isto, o primeiro tick real
  // arrancaria de basePrice outra vez, dando um salto brusco no gráfico em
  // relação ao close do último candle histórico gerado.
  const lastClose = baseCandles[baseCandles.length - 1].close;
  await prisma.syntheticIndex.update({
    where: { symbol: index.symbol },
    data: { lastPrice: lastClose },
  });
}

export async function runHistoricalBackfill() {
  const indices = await prisma.syntheticIndex.findMany({ where: { active: true } });
  for (const index of indices) {
    try {
      await backfillSymbol(index);
    } catch (err) {
      // Um símbolo falhar no backfill não deve impedir o arranque do serviço
      // nem o backfill dos restantes símbolos.
      console.error(`[historicalBackfill] erro no símbolo ${index.symbol}:`, err);
    }
  }
}
