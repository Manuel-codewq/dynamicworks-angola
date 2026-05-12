import type { CandlestickData, Time } from "lightweight-charts";

type LV = { time: Time; value: number };

// ── Trend ─────────────────────────────────────────────────────────────────────

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

export interface AlligatorResult { jaw: LV[]; teeth: LV[]; lips: LV[]; }

export function calcAlligator(candles: CandlestickData[]): AlligatorResult {
  function smma(period: number, offset: number): LV[] {
    if (candles.length < period + offset) return [];
    const mids = candles.map(c => (c.high + c.low) / 2);
    let val = mids.slice(0, period).reduce((s, v) => s + v, 0) / period;
    const out: LV[] = [];
    for (let i = period - 1; i < candles.length - offset; i++) {
      if (i > period - 1) val = (val * (period - 1) + mids[i]) / period;
      out.push({ time: candles[i + offset].time, value: val });
    }
    return out;
  }
  return { jaw: smma(13, 8), teeth: smma(8, 5), lips: smma(5, 3) };
}

export interface DonchianResult { high: LV[]; mid: LV[]; low: LV[]; }

export function calcDonchian(candles: CandlestickData[], period = 20): DonchianResult {
  const high: LV[] = [], mid: LV[] = [], low: LV[] = [];
  if (candles.length < period) return { high, mid, low };
  for (let i = period - 1; i < candles.length; i++) {
    const slice = candles.slice(i - period + 1, i + 1);
    const h = Math.max(...slice.map(c => c.high));
    const l = Math.min(...slice.map(c => c.low));
    high.push({ time: candles[i].time, value: h });
    low.push({ time: candles[i].time, value: l });
    mid.push({ time: candles[i].time, value: (h + l) / 2 });
  }
  return { high, mid, low };
}

export interface KeltnerResult { upper: LV[]; mid: LV[]; lower: LV[]; }

export function calcKeltner(candles: CandlestickData[], period = 20, mult = 2): KeltnerResult {
  const upper: LV[] = [], mid: LV[] = [], lower: LV[] = [];
  if (candles.length < period + 1) return { upper, mid, lower };
  const ema = calcEMA(candles, period);
  // ATR for keltner
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    trs.push(Math.max(candles[i].high - candles[i].low, Math.abs(candles[i].high - candles[i-1].close), Math.abs(candles[i].low - candles[i-1].close)));
  }
  let atr = trs.slice(0, period).reduce((s, v) => s + v, 0) / period;
  const atrSeries: number[] = [atr];
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
    atrSeries.push(atr);
  }
  const offset = candles.length - ema.length;
  ema.forEach((e, i) => {
    const atrVal = atrSeries[i + offset - period] ?? atrSeries[atrSeries.length - 1] ?? 0;
    mid.push({ time: e.time, value: e.value });
    upper.push({ time: e.time, value: e.value + mult * atrVal });
    lower.push({ time: e.time, value: e.value - mult * atrVal });
  });
  return { upper, mid, lower };
}

export function calcParabolicSAR(candles: CandlestickData[], step = 0.02, max = 0.2): LV[] {
  if (candles.length < 2) return [];
  const result: LV[] = [];
  let bull = true;
  let sar  = candles[0].low;
  let ep   = candles[0].high;
  let af   = step;
  for (let i = 1; i < candles.length; i++) {
    sar = sar + af * (ep - sar);
    if (bull) {
      if (i >= 2) sar = Math.min(sar, candles[i-1].low, candles[i-2].low);
      if (candles[i].low < sar) {
        bull = false; sar = ep; ep = candles[i].low; af = step;
      } else {
        if (candles[i].high > ep) { ep = candles[i].high; af = Math.min(af + step, max); }
      }
    } else {
      if (i >= 2) sar = Math.max(sar, candles[i-1].high, candles[i-2].high);
      if (candles[i].high > sar) {
        bull = true; sar = ep; ep = candles[i].high; af = step;
      } else {
        if (candles[i].low < ep) { ep = candles[i].low; af = Math.min(af + step, max); }
      }
    }
    result.push({ time: candles[i].time, value: sar });
  }
  return result;
}

// ── Oscillators ───────────────────────────────────────────────────────────────

export function calcRSI(candles: CandlestickData[], period = 14): LV[] {
  if (candles.length < period + 1) return [];
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const d = candles[i].close - candles[i - 1].close;
    if (d > 0) avgGain += d; else avgLoss -= d;
  }
  avgGain /= period; avgLoss /= period;
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
  macd: LV[]; signal: LV[];
  histogram: { time: Time; value: number; color: string }[];
}

export function calcMACD(candles: CandlestickData[], fast = 12, slow = 26, signalPeriod = 9): MACDResult {
  const fastEMA = calcEMA(candles, fast);
  const slowEMA = calcEMA(candles, slow);
  if (!fastEMA.length || !slowEMA.length) return { macd: [], signal: [], histogram: [] };
  const offset  = fastEMA.length - slowEMA.length;
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
    const slice = candles.slice(i - kPeriod + 1, i + 1);
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

export function calcATR(candles: CandlestickData[], period = 14): LV[] {
  if (candles.length < period + 1) return [];
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    trs.push(Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i-1].close),
      Math.abs(candles[i].low  - candles[i-1].close),
    ));
  }
  let atr = trs.slice(0, period).reduce((s, v) => s + v, 0) / period;
  const result: LV[] = [{ time: candles[period].time, value: atr }];
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
    result.push({ time: candles[i + 1].time, value: atr });
  }
  return result;
}

export function calcCCI(candles: CandlestickData[], period = 20): LV[] {
  const result: LV[] = [];
  if (candles.length < period) return result;
  for (let i = period - 1; i < candles.length; i++) {
    const slice = candles.slice(i - period + 1, i + 1);
    const tp   = slice.map(c => (c.high + c.low + c.close) / 3);
    const mean = tp.reduce((s, v) => s + v, 0) / period;
    const md   = tp.reduce((s, v) => s + Math.abs(v - mean), 0) / period;
    result.push({ time: candles[i].time, value: md === 0 ? 0 : (tp[tp.length - 1] - mean) / (0.015 * md) });
  }
  return result;
}

export function calcWilliamsR(candles: CandlestickData[], period = 14): LV[] {
  const result: LV[] = [];
  if (candles.length < period) return result;
  for (let i = period - 1; i < candles.length; i++) {
    const slice = candles.slice(i - period + 1, i + 1);
    const hh = Math.max(...slice.map(c => c.high));
    const ll = Math.min(...slice.map(c => c.low));
    result.push({ time: candles[i].time, value: hh === ll ? -50 : -100 * (hh - candles[i].close) / (hh - ll) });
  }
  return result;
}

export function calcMomentum(candles: CandlestickData[], period = 10): LV[] {
  const result: LV[] = [];
  for (let i = period; i < candles.length; i++) {
    result.push({ time: candles[i].time, value: candles[i].close - candles[i - period].close });
  }
  return result;
}

export function calcAO(candles: CandlestickData[]): { time: Time; value: number; color: string }[] {
  if (candles.length < 34) return [];
  const mids = candles.map(c => (c.high + c.low) / 2);
  const result: { time: Time; value: number; color: string }[] = [];
  for (let i = 33; i < candles.length; i++) {
    const fast = mids.slice(i - 4, i + 1).reduce((s, v) => s + v, 0) / 5;
    const slow = mids.slice(i - 33, i + 1).reduce((s, v) => s + v, 0) / 34;
    const val  = fast - slow;
    const prev = result.length > 0 ? result[result.length - 1].value : 0;
    result.push({ time: candles[i].time, value: val, color: val >= prev ? "#22c55e80" : "#ef444480" });
  }
  return result;
}

export interface ADXResult { adx: LV[]; diPlus: LV[]; diMinus: LV[]; }

export function calcADX(candles: CandlestickData[], period = 14): ADXResult {
  if (candles.length < period * 2 + 1) return { adx: [], diPlus: [], diMinus: [] };
  const trs: number[] = [], pDMs: number[] = [], mDMs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    trs.push(Math.max(candles[i].high - candles[i].low, Math.abs(candles[i].high - candles[i-1].close), Math.abs(candles[i].low - candles[i-1].close)));
    const up   = candles[i].high - candles[i-1].high;
    const down = candles[i-1].low - candles[i].low;
    pDMs.push(up > down && up > 0 ? up : 0);
    mDMs.push(down > up && down > 0 ? down : 0);
  }
  let atr14 = trs.slice(0, period).reduce((s, v) => s + v, 0);
  let pdm14 = pDMs.slice(0, period).reduce((s, v) => s + v, 0);
  let mdm14 = mDMs.slice(0, period).reduce((s, v) => s + v, 0);
  const adx: LV[] = [], diPlus: LV[] = [], diMinus: LV[] = [], dxs: number[] = [];
  for (let i = period; i < trs.length; i++) {
    atr14 = atr14 - atr14 / period + trs[i];
    pdm14 = pdm14 - pdm14 / period + pDMs[i];
    mdm14 = mdm14 - mdm14 / period + mDMs[i];
    const pdi = atr14 ? 100 * pdm14 / atr14 : 0;
    const mdi = atr14 ? 100 * mdm14 / atr14 : 0;
    dxs.push((pdi + mdi) ? 100 * Math.abs(pdi - mdi) / (pdi + mdi) : 0);
    diPlus.push({ time: candles[i + 1].time, value: pdi });
    diMinus.push({ time: candles[i + 1].time, value: mdi });
    if (dxs.length >= period) {
      adx.push({ time: candles[i + 1].time, value: dxs.slice(-period).reduce((s, v) => s + v, 0) / period });
    }
  }
  return { adx, diPlus, diMinus };
}

export function calcBearsBulls(candles: CandlestickData[], period = 13): { bears: LV[]; bulls: LV[] } {
  const ema = calcEMA(candles, period);
  const offset = candles.length - ema.length;
  const bears: LV[] = [], bulls: LV[] = [];
  ema.forEach((e, i) => {
    bears.push({ time: e.time, value: candles[i + offset].low  - e.value });
    bulls.push({ time: e.time, value: candles[i + offset].high - e.value });
  });
  return { bears, bulls };
}
