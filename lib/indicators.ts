import type { CandlestickData, Time } from "lightweight-charts";

type LV = { time: Time; value: number };

export function calcSMA(candles: CandlestickData[], period: number): LV[] {
  const result: LV[] = [];
  if (period < 2 || candles.length < period) return result;
  for (let i = period - 1; i < candles.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) sum += candles[i - j].close;
    result.push({ time: candles[i].time, value: sum / period });
  }
  return result;
}

export function calcEMA(candles: CandlestickData[], period: number): LV[] {
  if (period < 2 || candles.length < period) return [];
  const k = 2 / (period + 1);
  let ema = 0;
  for (let i = 0; i < period; i++) ema += candles[i].close;
  ema /= period;
  const result: LV[] = [{ time: candles[period - 1].time, value: ema }];
  for (let i = period; i < candles.length; i++) {
    ema = candles[i].close * k + ema * (1 - k);
    result.push({ time: candles[i].time, value: ema });
  }
  return result;
}

export interface BBBands { upper: LV[]; middle: LV[]; lower: LV[]; }

export function calcBB(candles: CandlestickData[], period: number, mult = 2): BBBands {
  const upper: LV[] = [], middle: LV[] = [], lower: LV[] = [];
  if (period < 2 || candles.length < period) return { upper, middle, lower };
  for (let i = period - 1; i < candles.length; i++) {
    const slice = candles.slice(i - period + 1, i + 1);
    const mean  = slice.reduce((s, c) => s + c.close, 0) / period;
    const std   = Math.sqrt(slice.reduce((s, c) => s + (c.close - mean) ** 2, 0) / period);
    const t     = candles[i].time;
    middle.push({ time: t, value: mean });
    upper.push({ time: t, value: mean + mult * std });
    lower.push({ time: t, value: mean - mult * std });
  }
  return { upper, middle, lower };
}

export function calcRSI(candles: CandlestickData[], period = 14): LV[] {
  if (candles.length < period + 1) return [];
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const d = candles[i].close - candles[i - 1].close;
    if (d > 0) avgGain += d; else avgLoss -= d;
  }
  avgGain /= period;
  avgLoss /= period;
  const result: LV[] = [];
  result.push({ time: candles[period].time, value: avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss) });
  for (let i = period + 1; i < candles.length; i++) {
    const d = candles[i].close - candles[i - 1].close;
    avgGain = (avgGain * (period - 1) + (d > 0 ? d : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (d < 0 ? -d : 0)) / period;
    result.push({ time: candles[i].time, value: avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss) });
  }
  return result;
}

export interface MACDResult {
  macd:      LV[];
  signal:    LV[];
  histogram: { time: Time; value: number; color: string }[];
}

export function calcMACD(candles: CandlestickData[], fast = 12, slow = 26, signalPeriod = 9): MACDResult {
  const fastEMA = calcEMA(candles, fast);
  const slowEMA = calcEMA(candles, slow);
  if (!fastEMA.length || !slowEMA.length) return { macd: [], signal: [], histogram: [] };

  // slowEMA is shorter — align from its start
  const offset  = fastEMA.length - slowEMA.length; // = slow - fast
  const macdLine: LV[] = slowEMA.map((s, i) => ({ time: s.time, value: fastEMA[i + offset].value - s.value }));

  if (macdLine.length < signalPeriod) return { macd: macdLine, signal: [], histogram: [] };

  const k = 2 / (signalPeriod + 1);
  let sig = macdLine.slice(0, signalPeriod).reduce((s, v) => s + v.value, 0) / signalPeriod;
  const signalLine: LV[] = [{ time: macdLine[signalPeriod - 1].time, value: sig }];
  for (let i = signalPeriod; i < macdLine.length; i++) {
    sig = macdLine[i].value * k + sig * (1 - k);
    signalLine.push({ time: macdLine[i].time, value: sig });
  }

  const hOffset = macdLine.length - signalLine.length;
  const histogram = signalLine.map((s, i) => {
    const h = macdLine[i + hOffset].value - s.value;
    return { time: s.time, value: h, color: h >= 0 ? "#22c55e80" : "#ef444480" };
  });

  return { macd: macdLine, signal: signalLine, histogram };
}

export interface StochResult { k: LV[]; d: LV[]; }

export function calcStochastic(candles: CandlestickData[], kPeriod = 14, dPeriod = 3): StochResult {
  if (candles.length < kPeriod) return { k: [], d: [] };
  const kLine: LV[] = [];
  for (let i = kPeriod - 1; i < candles.length; i++) {
    const slice   = candles.slice(i - kPeriod + 1, i + 1);
    const highest = Math.max(...slice.map(c => c.high));
    const lowest  = Math.min(...slice.map(c => c.low));
    const range   = highest - lowest;
    kLine.push({ time: candles[i].time, value: range === 0 ? 50 : 100 * (candles[i].close - lowest) / range });
  }
  const dLine: LV[] = [];
  for (let i = dPeriod - 1; i < kLine.length; i++) {
    const sum = kLine.slice(i - dPeriod + 1, i + 1).reduce((s, v) => s + v.value, 0);
    dLine.push({ time: kLine[i].time, value: sum / dPeriod });
  }
  return { k: kLine, d: dLine };
}
