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

// ── New Indicators ─────────────────────────────────────────────────────────────

export function calcSupertrend(candles: CandlestickData[], period = 10, mult = 3): { line: LV[]; up: LV[]; down: LV[] } {
  const line: LV[] = [], up: LV[] = [], down: LV[] = [];
  if (candles.length < period + 1) return { line, up, down };
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    trs.push(Math.max(candles[i].high - candles[i].low, Math.abs(candles[i].high - candles[i-1].close), Math.abs(candles[i].low - candles[i-1].close)));
  }
  let atr = trs.slice(0, period).reduce((s, v) => s + v, 0) / period;
  const atrs: number[] = new Array(period).fill(0);
  atrs.push(atr);
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
    atrs.push(atr);
  }
  let bull = true;
  let upperBand = 0, lowerBand = 0;
  for (let i = period; i < candles.length; i++) {
    const hl2 = (candles[i].high + candles[i].low) / 2;
    const a = atrs[i] ?? atr;
    let ub = hl2 + mult * a;
    let lb = hl2 - mult * a;
    if (i > period) {
      if (lb < lowerBand || candles[i-1].close < lowerBand) lb = lb;
      else lb = lowerBand;
      if (ub > upperBand || candles[i-1].close > upperBand) ub = ub;
      else ub = upperBand;
    }
    upperBand = ub; lowerBand = lb;
    if (bull) {
      if (candles[i].close < lowerBand) bull = false;
    } else {
      if (candles[i].close > upperBand) bull = true;
    }
    const val = bull ? lowerBand : upperBand;
    line.push({ time: candles[i].time, value: val });
    if (bull) up.push({ time: candles[i].time, value: val });
    else down.push({ time: candles[i].time, value: val });
  }
  return { line, up, down };
}

export function calcIchimoku(candles: CandlestickData[]): { tenkan: LV[]; kijun: LV[]; senkouA: LV[]; senkouB: LV[]; chikou: LV[] } {
  const tenkan: LV[] = [], kijun: LV[] = [], senkouA: LV[] = [], senkouB: LV[] = [], chikou: LV[] = [];
  const mid = (arr: CandlestickData[], from: number, len: number) => {
    const sl = arr.slice(from, from + len);
    return (Math.max(...sl.map(c => c.high)) + Math.min(...sl.map(c => c.low))) / 2;
  };
  for (let i = 0; i < candles.length; i++) {
    if (i >= 8)  tenkan.push({ time: candles[i].time, value: mid(candles, i - 8, 9) });
    if (i >= 25) kijun.push({ time: candles[i].time, value: mid(candles, i - 25, 26) });
    if (i >= 25) {
      const t = tenkan.find(x => (x.time as number) === (candles[i].time as number));
      const k = kijun[kijun.length - 1];
      if (t && k) senkouA.push({ time: candles[i].time, value: (t.value + k.value) / 2 });
    }
    if (i >= 51) senkouB.push({ time: candles[i].time, value: mid(candles, i - 51, 52) });
    if (i + 26 < candles.length) chikou.push({ time: candles[i + 26].time, value: candles[i].close });
  }
  return { tenkan, kijun, senkouA, senkouB, chikou };
}

export function calcFractals(candles: CandlestickData[]): { up: Array<{time:Time;position:"aboveBar";shape:"arrowDown";color:string;size:1}>; down: Array<{time:Time;position:"belowBar";shape:"arrowUp";color:string;size:1}> } {
  const up: Array<{time:Time;position:"aboveBar";shape:"arrowDown";color:string;size:1}> = [];
  const down: Array<{time:Time;position:"belowBar";shape:"arrowUp";color:string;size:1}> = [];
  for (let i = 2; i < candles.length - 2; i++) {
    if (candles[i].high > candles[i-1].high && candles[i].high > candles[i-2].high && candles[i].high > candles[i+1].high && candles[i].high > candles[i+2].high)
      up.push({ time: candles[i].time, position: "aboveBar", shape: "arrowDown", color: "#ef4444", size: 1 });
    if (candles[i].low < candles[i-1].low && candles[i].low < candles[i-2].low && candles[i].low < candles[i+1].low && candles[i].low < candles[i+2].low)
      down.push({ time: candles[i].time, position: "belowBar", shape: "arrowUp", color: "#22c55e", size: 1 });
  }
  return { up, down };
}

export function calcZigZag(candles: CandlestickData[], deviation = 5): LV[] {
  const result: LV[] = [];
  if (candles.length < 3) return result;
  const dev = deviation / 100;
  let lastPivotIdx = 0;
  let lastPivotHigh = candles[0].high;
  let lastPivotLow  = candles[0].low;
  let trend: 1 | -1 = 1;
  result.push({ time: candles[0].time, value: candles[0].close });
  for (let i = 1; i < candles.length; i++) {
    if (trend === 1) {
      if (candles[i].high > lastPivotHigh) { lastPivotHigh = candles[i].high; lastPivotIdx = i; }
      else if (candles[i].low < lastPivotHigh * (1 - dev)) {
        result.push({ time: candles[lastPivotIdx].time, value: lastPivotHigh });
        trend = -1; lastPivotLow = candles[i].low; lastPivotIdx = i;
      }
    } else {
      if (candles[i].low < lastPivotLow) { lastPivotLow = candles[i].low; lastPivotIdx = i; }
      else if (candles[i].high > lastPivotLow * (1 + dev)) {
        result.push({ time: candles[lastPivotIdx].time, value: lastPivotLow });
        trend = 1; lastPivotHigh = candles[i].high; lastPivotIdx = i;
      }
    }
  }
  result.push({ time: candles[candles.length - 1].time, value: trend === 1 ? lastPivotHigh : lastPivotLow });
  return result;
}

export function calcAroon(candles: CandlestickData[], period = 14): { up: LV[]; down: LV[] } {
  const up: LV[] = [], down: LV[] = [];
  if (candles.length < period + 1) return { up, down };
  for (let i = period; i < candles.length; i++) {
    const slice = candles.slice(i - period, i + 1);
    let hIdx = 0, lIdx = 0;
    for (let j = 1; j <= period; j++) {
      if (slice[j].high >= slice[hIdx].high) hIdx = j;
      if (slice[j].low  <= slice[lIdx].low)  lIdx = j;
    }
    up.push({ time: candles[i].time, value: (hIdx / period) * 100 });
    down.push({ time: candles[i].time, value: (lIdx / period) * 100 });
  }
  return { up, down };
}

export function calcROC(candles: CandlestickData[], period = 12): LV[] {
  const result: LV[] = [];
  for (let i = period; i < candles.length; i++) {
    const prev = candles[i - period].close;
    result.push({ time: candles[i].time, value: prev === 0 ? 0 : ((candles[i].close - prev) / prev) * 100 });
  }
  return result;
}

export function calcSTC(candles: CandlestickData[], fast = 23, slow = 50, k = 10): LV[] {
  if (candles.length < slow + k * 2) return [];
  const fastEMA = calcEMA(candles, fast);
  const slowEMA = calcEMA(candles, slow);
  const offset  = fastEMA.length - slowEMA.length;
  const macdLine = slowEMA.map((s, i) => fastEMA[i + offset].value - s.value);
  const stoch = (arr: number[], p: number): number[] => {
    const out: number[] = [];
    for (let i = p - 1; i < arr.length; i++) {
      const sl = arr.slice(i - p + 1, i + 1);
      const h = Math.max(...sl), l = Math.min(...sl);
      out.push(h === l ? 50 : ((arr[i] - l) / (h - l)) * 100);
    }
    return out;
  };
  const smoothEMA = (arr: number[], p: number): number[] => {
    if (arr.length < p) return [];
    const ke = 2 / (p + 1);
    let e = arr.slice(0, p).reduce((s, v) => s + v, 0) / p;
    const out = [e];
    for (let i = p; i < arr.length; i++) { e = arr[i] * ke + e * (1 - ke); out.push(e); }
    return out;
  };
  const k1 = stoch(macdLine, k);
  const d1 = smoothEMA(k1, 3);
  const k2 = stoch(d1, k);
  const d2 = smoothEMA(k2, 3);
  const startIdx = slowEMA.length - d2.length;
  return d2.map((v, i) => ({ time: slowEMA[startIdx + i].time, value: v }));
}

export function calcVortex(candles: CandlestickData[], period = 14): { viPlus: LV[]; viMinus: LV[] } {
  const viPlus: LV[] = [], viMinus: LV[] = [];
  if (candles.length < period + 1) return { viPlus, viMinus };
  for (let i = period; i < candles.length; i++) {
    let trSum = 0, vpSum = 0, vmSum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      trSum += Math.max(candles[j].high - candles[j].low, Math.abs(candles[j].high - candles[j-1].close), Math.abs(candles[j].low - candles[j-1].close));
      vpSum += Math.abs(candles[j].high - candles[j-1].low);
      vmSum += Math.abs(candles[j].low  - candles[j-1].high);
    }
    viPlus.push({ time: candles[i].time, value: trSum === 0 ? 0 : vpSum / trSum });
    viMinus.push({ time: candles[i].time, value: trSum === 0 ? 0 : vmSum / trSum });
  }
  return { viPlus, viMinus };
}

export function calcDeMarker(candles: CandlestickData[], period = 14): LV[] {
  const result: LV[] = [];
  if (candles.length < period + 1) return result;
  const deMax: number[] = [], deMin: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    deMax.push(Math.max(0, candles[i].high - candles[i-1].high));
    deMin.push(Math.max(0, candles[i-1].low - candles[i].low));
  }
  for (let i = period - 1; i < deMax.length; i++) {
    const sumMax = deMax.slice(i - period + 1, i + 1).reduce((s, v) => s + v, 0);
    const sumMin = deMin.slice(i - period + 1, i + 1).reduce((s, v) => s + v, 0);
    result.push({ time: candles[i + 1].time, value: (sumMax + sumMin) === 0 ? 0.5 : sumMax / (sumMax + sumMin) });
  }
  return result;
}

export function calcVolumeOsc(candles: CandlestickData[], fast = 5, slow = 10): LV[] {
  const vols = candles.map(c => (c as any).volume != null ? (c as any).volume as number : c.high - c.low);
  const emaV = (arr: number[], p: number): number[] => {
    if (arr.length < p) return [];
    const k = 2 / (p + 1);
    let e = arr.slice(0, p).reduce((s, v) => s + v, 0) / p;
    const out: number[] = [e];
    for (let i = p; i < arr.length; i++) { e = arr[i] * k + e * (1 - k); out.push(e); }
    return out;
  };
  const fastEMA = emaV(vols, fast);
  const slowEMA = emaV(vols, slow);
  const off = fastEMA.length - slowEMA.length;
  return slowEMA.map((s, i) => {
    const f = fastEMA[i + off];
    return { time: candles[candles.length - slowEMA.length + i].time, value: s === 0 ? 0 : ((f - s) / s) * 100 };
  });
}

export function calcWeisWaves(candles: CandlestickData[]): Array<{time:Time;value:number;color:string}> {
  const result: Array<{time:Time;value:number;color:string}> = [];
  if (candles.length < 2) return result;
  let dir = candles[1].close >= candles[0].close ? 1 : -1;
  let acc = 0;
  for (let i = 1; i < candles.length; i++) {
    const vol = (candles[i] as any).volume != null ? (candles[i] as any).volume as number : (candles[i].high - candles[i].low);
    const newDir = candles[i].close >= candles[i-1].close ? 1 : -1;
    if (newDir !== dir) { acc = 0; dir = newDir; }
    acc += vol;
    result.push({ time: candles[i].time, value: acc, color: dir === 1 ? "#22c55e80" : "#ef444480" });
  }
  return result;
}
