import { prisma } from "./prisma";
import { FOREX_PAIRS, CRYPTO_PAIRS, COMMODITY_PAIRS, SYNTHETIC_PAIRS } from "./derivWebSocket";

const ALL_PAIRS = [
  // Forex
  "EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD",
  "USD/CAD", "EUR/GBP", "USD/CHF", "NZD/USD",
  "EUR/JPY", "GBP/JPY", "EUR/CAD", "AUD/JPY", "GBP/AUD", "EUR/CHF",
  // Cripto
  "BTC/USD", "ETH/USD",
  // Metais (sem XAU/USD)
  "XAG/USD",
  // Sintéticos DW (24/7)
  "DW Index 10", "DW Index 25", "DW Index 50", "DW Index 75", "DW Index 100",
] as const;

// Labels de todos os pares reais (usado como default de activePairs)
export const ALL_REAL_PAIR_LABELS = [
  ...FOREX_PAIRS.map(p => p.label),
  ...CRYPTO_PAIRS.map(p => p.label),
  ...COMMODITY_PAIRS.map(p => p.label),
];

export const DEFAULT_PAYOUT          = Object.fromEntries(ALL_PAIRS.map(p => [p, 0.85]));
export const DEFAULT_WIN_PROBABILITY = Object.fromEntries(ALL_PAIRS.map(p => [p, 0.47]));
export const DEFAULT_RANKING_RESET: Date | null = null;
export const DEFAULT_WEEKEND_PAIRS   = SYNTHETIC_PAIRS.map(p => p.symbol);
export const DEFAULT_ACTIVE_PAIRS    = ALL_REAL_PAIR_LABELS;

export const ALL_PAIR_KEYS = ALL_PAIRS as unknown as string[];

export interface PlatformSettings {
  payout:          Record<string, number>;
  winProbability:  Record<string, number>;
  maintenanceMode: boolean;
  forceRealMarket: boolean;
  activePairs:     string[];
  weekendPairs:    string[];
  rankingResetAt:  Date | null;
  usdtRateAoa:     number;
  usdtWallet:      string | null;
  usdtMinDeposit:  number;
}

// In-memory cache with 15s TTL — keeps DB load low while reflecting admin changes quickly
let cache: PlatformSettings | null = null;
let cacheAt = 0;
const CACHE_TTL = 15_000;

export async function getSettings(): Promise<PlatformSettings> {
  if (cache && Date.now() - cacheAt < CACHE_TTL) return cache;
  try {
    const row = await prisma.settings.upsert({
      where:  { id: "singleton" },
      create: { id: "singleton", maintenanceMode: false, forceRealMarket: false, payout: DEFAULT_PAYOUT, winProbability: DEFAULT_WIN_PROBABILITY, activePairs: DEFAULT_ACTIVE_PAIRS, weekendPairs: DEFAULT_WEEKEND_PAIRS, rankingResetAt: null },
      update: {},
    }) as any;
    const savedPairs        = Array.isArray(row.activePairs)   ? row.activePairs   as string[] : [];
    const savedWeekendPairs = Array.isArray(row.weekendPairs)  ? row.weekendPairs  as string[] : [];
    cache = {
      maintenanceMode: row.maintenanceMode,
      forceRealMarket: row.forceRealMarket ?? false,
      payout:          { ...DEFAULT_PAYOUT,          ...(row.payout          as Record<string, number> ?? {}) },
      winProbability:  { ...DEFAULT_WIN_PROBABILITY, ...(row.winProbability  as Record<string, number> ?? {}) },
      activePairs:     savedPairs.length > 0 ? savedPairs : DEFAULT_ACTIVE_PAIRS,
      weekendPairs:    savedWeekendPairs.length > 0 ? savedWeekendPairs : DEFAULT_WEEKEND_PAIRS,
      rankingResetAt:  row.rankingResetAt ? new Date(row.rankingResetAt) : null,
      usdtRateAoa:     Number(row.usdtRateAoa ?? 0),
      usdtWallet:      row.usdtWallet ?? null,
      usdtMinDeposit:  Number(row.usdtMinDeposit ?? 5),
    };
    cacheAt = Date.now();
    return cache;
  } catch {
    return { maintenanceMode: false, forceRealMarket: false, payout: DEFAULT_PAYOUT, winProbability: DEFAULT_WIN_PROBABILITY, activePairs: DEFAULT_ACTIVE_PAIRS, weekendPairs: DEFAULT_WEEKEND_PAIRS, rankingResetAt: null, usdtRateAoa: 0, usdtWallet: null, usdtMinDeposit: 13 };
  }
}

export async function updateSettings(patch: Partial<PlatformSettings>): Promise<PlatformSettings> {
  const current = await getSettings();

  if (patch.payout && typeof patch.payout === "object") {
    Object.entries(patch.payout).forEach(([k, v]) => {
      const n = Number(v);
      if (isFinite(n) && n >= 0.50 && n <= 0.95) current.payout[k] = n;
    });
  }
  if (patch.winProbability && typeof patch.winProbability === "object") {
    Object.entries(patch.winProbability).forEach(([k, v]) => {
      const n = Number(v);
      if (isFinite(n) && n >= 0.30 && n <= 0.60) current.winProbability[k] = n;
    });
  }
  if (typeof patch.maintenanceMode === "boolean") current.maintenanceMode = patch.maintenanceMode;
  if (typeof patch.forceRealMarket === "boolean") current.forceRealMarket = patch.forceRealMarket;
  if (Array.isArray(patch.activePairs))  current.activePairs  = patch.activePairs;
  if (Array.isArray(patch.weekendPairs)) current.weekendPairs = patch.weekendPairs;
  if (patch.rankingResetAt instanceof Date || patch.rankingResetAt === null) current.rankingResetAt = patch.rankingResetAt;
  if (typeof patch.usdtRateAoa === "number" && isFinite(patch.usdtRateAoa) && patch.usdtRateAoa >= 0) current.usdtRateAoa = patch.usdtRateAoa;
  if (typeof patch.usdtWallet === "string" || patch.usdtWallet === null) current.usdtWallet = patch.usdtWallet || null;
  if (typeof patch.usdtMinDeposit === "number" && isFinite(patch.usdtMinDeposit) && patch.usdtMinDeposit >= 0) current.usdtMinDeposit = patch.usdtMinDeposit;

  await (prisma.settings.upsert as any)({
    where:  { id: "singleton" },
    create: { id: "singleton", ...current },
    update: { maintenanceMode: current.maintenanceMode, forceRealMarket: current.forceRealMarket, payout: current.payout, winProbability: current.winProbability, activePairs: current.activePairs, weekendPairs: current.weekendPairs, rankingResetAt: current.rankingResetAt, usdtRateAoa: current.usdtRateAoa, usdtWallet: current.usdtWallet, usdtMinDeposit: current.usdtMinDeposit },
  });

  cache = current;
  cacheAt = Date.now();
  return current;
}

// Synchronous fallback used by trade/worker routes that already have settings loaded
export let settings: PlatformSettings = { maintenanceMode: false, forceRealMarket: false, payout: DEFAULT_PAYOUT, winProbability: DEFAULT_WIN_PROBABILITY, activePairs: DEFAULT_ACTIVE_PAIRS, weekendPairs: DEFAULT_WEEKEND_PAIRS, rankingResetAt: null, usdtRateAoa: 0, usdtWallet: null, usdtMinDeposit: 13 };
export async function loadSettings() { settings = await getSettings(); return settings; }
