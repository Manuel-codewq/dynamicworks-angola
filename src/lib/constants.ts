export interface AssetConfig {
  sym: string;
  name: string;
  short: string;
  pip: number;
  mode: 'ACCU' | 'RISE_FALL' | 'BOTH';
}

// ── Índices Continuous (Accumulators) ───────────────────────────────────────
export const ACCU_ASSETS: AssetConfig[] = [
  { sym: 'R_10',      name: 'Volatility 10',       short: 'V10',     pip: 4, mode: 'ACCU' },
  { sym: 'R_10_1S',   name: 'Volatility 10 (1s)',  short: 'V10(1s)', pip: 2, mode: 'ACCU' },
  { sym: 'R_25',      name: 'Volatility 25',       short: 'V25',     pip: 4, mode: 'ACCU' },
  { sym: 'R_25_1S',   name: 'Volatility 25 (1s)',  short: 'V25(1s)', pip: 2, mode: 'ACCU' },
  { sym: 'R_50',      name: 'Volatility 50',       short: 'V50',     pip: 4, mode: 'ACCU' },
  { sym: 'R_50_1S',   name: 'Volatility 50 (1s)',  short: 'V50(1s)', pip: 2, mode: 'ACCU' },
  { sym: 'R_75',      name: 'Volatility 75',       short: 'V75',     pip: 4, mode: 'ACCU' },
  { sym: 'R_75_1S',   name: 'Volatility 75 (1s)',  short: 'V75(1s)', pip: 2, mode: 'ACCU' },
  { sym: 'R_100',     name: 'Volatility 100',      short: 'V100',    pip: 2, mode: 'ACCU' },
  { sym: 'R_100_1S',  name: 'Volatility 100 (1s)', short: 'V100(1s)',pip: 2, mode: 'ACCU' },
];

// ── Índices Crash/Boom (Rise/Fall) ───────────────────────────────────────────
export const RISE_FALL_ASSETS: AssetConfig[] = [
  { sym: 'BOOM1000XD',  name: 'Boom 1000',     short: 'BM1000', pip: 4, mode: 'RISE_FALL' },
  { sym: 'BOOM500XD',   name: 'Boom 500',      short: 'BM500',  pip: 4, mode: 'RISE_FALL' },
  { sym: 'BOOM300XD',   name: 'Boom 300',      short: 'BM300',  pip: 4, mode: 'RISE_FALL' },
  { sym: 'CRASH1000XD', name: 'Crash 1000',    short: 'CR1000', pip: 4, mode: 'RISE_FALL' },
  { sym: 'CRASH500XD',  name: 'Crash 500',     short: 'CR500',  pip: 4, mode: 'RISE_FALL' },
  { sym: 'CRASH300XD',  name: 'Crash 300',     short: 'CR300',  pip: 4, mode: 'RISE_FALL' },
];

// ── Lista unificada (para compatibilidade com código existente) ──────────────
export const ASSETS_AVAILABLE: AssetConfig[] = [
  ...ACCU_ASSETS,
  ...RISE_FALL_ASSETS,
];

// ── Approximate barrier based on growth rate for Accumulators ───────────────
export const BARRIERS: Record<number, number> = {
  1: 0.0041,
  2: 0.0029,
  3: 0.0021,
  4: 0.0017,
  5: 0.0013,
};
