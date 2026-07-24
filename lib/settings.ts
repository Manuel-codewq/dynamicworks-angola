import { prisma } from "./prisma";
import { CRYPTO_PAIRS } from "./derivWebSocket";

const ALL_PAIRS = [
  "BTC/USD", "ETH/USD", "BNB/USD", "SOL/USD",
  "XRP/USD", "ADA/USD", "DOGE/USD", "LTC/USD",
] as const;

export const ALL_REAL_PAIR_LABELS = CRYPTO_PAIRS.map(p => p.label);

export const DEFAULT_PAYOUT          = Object.fromEntries(ALL_PAIRS.map(p => [p, 0.85]));
export const DEFAULT_WIN_PROBABILITY = Object.fromEntries(ALL_PAIRS.map(p => [p, 0.47]));
export const DEFAULT_RANKING_RESET: Date | null = null;
export const DEFAULT_WEEKEND_PAIRS: string[] = [];
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
  usdtRateAoa:              number;
  usdtWallet:               string | null;
  usdtMinDeposit:           number;
  largeTradePushThreshold:  number;
  largeWithdrawalThreshold: number;
  dailyLossLimitPct:        number;
  depositBonusActive:       boolean;
  depositBonusPct:          number;
  depositBonusMinAoa:       number;
  depositBonusType:         "first" | "all";
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
      create: { id: "singleton", maintenanceMode: false, forceRealMarket: false, payout: DEFAULT_PAYOUT, winProbability: DEFAULT_WIN_PROBABILITY, activePairs: DEFAULT_ACTIVE_PAIRS, weekendPairs: DEFAULT_WEEKEND_PAIRS, rankingResetAt: null, largeTradePushThreshold: 0, largeWithdrawalThreshold: 0, dailyLossLimitPct: 0 },
      update: {},
    }) as any;
    const savedPairs        = Array.isArray(row.activePairs)  ? row.activePairs  as string[] : null;
    const savedWeekendPairs = Array.isArray(row.weekendPairs) ? row.weekendPairs as string[] : null;
    const validKeys = new Set<string>(ALL_PAIRS);
    const rawPayout = (row.payout as Record<string, number>) ?? {};
    const rawWinProb = (row.winProbability as Record<string, number>) ?? {};
    cache = {
      maintenanceMode: row.maintenanceMode,
      forceRealMarket: row.forceRealMarket ?? false,
      payout:         { ...DEFAULT_PAYOUT,          ...Object.fromEntries(Object.entries(rawPayout).filter(([k]) => validKeys.has(k))) },
      winProbability: { ...DEFAULT_WIN_PROBABILITY, ...Object.fromEntries(Object.entries(rawWinProb).filter(([k]) => validKeys.has(k))) },
      activePairs:     savedPairs  !== null ? savedPairs  : DEFAULT_ACTIVE_PAIRS,
      weekendPairs:    savedWeekendPairs !== null ? savedWeekendPairs : DEFAULT_WEEKEND_PAIRS,
      rankingResetAt:  row.rankingResetAt ? new Date(row.rankingResetAt) : null,
      usdtRateAoa:              Number(row.usdtRateAoa ?? 0),
      usdtWallet:               row.usdtWallet ?? null,
      usdtMinDeposit:           Number(row.usdtMinDeposit ?? 5),
      largeTradePushThreshold:  Number(row.largeTradePushThreshold ?? 0),
      largeWithdrawalThreshold: Number(row.largeWithdrawalThreshold ?? 0),
      dailyLossLimitPct:        Number(row.dailyLossLimitPct ?? 0),
      depositBonusActive:       Boolean(row.depositBonusActive ?? false),
      depositBonusPct:          Number(row.depositBonusPct ?? 10),
      depositBonusMinAoa:       Number(row.depositBonusMinAoa ?? 50000),
      depositBonusType:         (row.depositBonusType === "all" ? "all" : "first") as "first" | "all",
    };
    cacheAt = Date.now();
    return cache;
  } catch {
    return { maintenanceMode: false, forceRealMarket: false, payout: DEFAULT_PAYOUT, winProbability: DEFAULT_WIN_PROBABILITY, activePairs: DEFAULT_ACTIVE_PAIRS, weekendPairs: DEFAULT_WEEKEND_PAIRS, rankingResetAt: null, usdtRateAoa: 0, usdtWallet: null, usdtMinDeposit: 13, largeTradePushThreshold: 0, largeWithdrawalThreshold: 0, dailyLossLimitPct: 0, depositBonusActive: false, depositBonusPct: 10, depositBonusMinAoa: 50000, depositBonusType: "first" as const };
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
  if (typeof patch.largeTradePushThreshold === "number" && isFinite(patch.largeTradePushThreshold) && patch.largeTradePushThreshold >= 0) current.largeTradePushThreshold = patch.largeTradePushThreshold;
  if (typeof patch.largeWithdrawalThreshold === "number" && isFinite(patch.largeWithdrawalThreshold) && patch.largeWithdrawalThreshold >= 0) current.largeWithdrawalThreshold = patch.largeWithdrawalThreshold;
  if (typeof patch.dailyLossLimitPct === "number" && isFinite(patch.dailyLossLimitPct) && patch.dailyLossLimitPct >= 0 && patch.dailyLossLimitPct <= 100) current.dailyLossLimitPct = patch.dailyLossLimitPct;
  if (typeof patch.depositBonusActive === "boolean") current.depositBonusActive = patch.depositBonusActive;
  if (typeof patch.depositBonusPct === "number" && isFinite(patch.depositBonusPct) && patch.depositBonusPct >= 0 && patch.depositBonusPct <= 100) current.depositBonusPct = patch.depositBonusPct;
  if (typeof patch.depositBonusMinAoa === "number" && isFinite(patch.depositBonusMinAoa) && patch.depositBonusMinAoa >= 0) current.depositBonusMinAoa = patch.depositBonusMinAoa;
  if (patch.depositBonusType === "first" || patch.depositBonusType === "all") current.depositBonusType = patch.depositBonusType;

  await (prisma.settings.upsert as any)({
    where:  { id: "singleton" },
    create: { id: "singleton", ...current },
    update: { maintenanceMode: current.maintenanceMode, forceRealMarket: current.forceRealMarket, payout: current.payout, winProbability: current.winProbability, activePairs: current.activePairs, weekendPairs: current.weekendPairs, rankingResetAt: current.rankingResetAt, usdtRateAoa: current.usdtRateAoa, usdtWallet: current.usdtWallet, usdtMinDeposit: current.usdtMinDeposit, largeTradePushThreshold: current.largeTradePushThreshold, largeWithdrawalThreshold: current.largeWithdrawalThreshold, dailyLossLimitPct: current.dailyLossLimitPct, depositBonusActive: current.depositBonusActive, depositBonusPct: current.depositBonusPct, depositBonusMinAoa: current.depositBonusMinAoa, depositBonusType: current.depositBonusType },
  });

  cache = current;
  cacheAt = Date.now();
  return current;
}

// Synchronous fallback used by trade/worker routes that already have settings loaded
export let settings: PlatformSettings = { maintenanceMode: false, forceRealMarket: false, payout: DEFAULT_PAYOUT, winProbability: DEFAULT_WIN_PROBABILITY, activePairs: DEFAULT_ACTIVE_PAIRS, weekendPairs: DEFAULT_WEEKEND_PAIRS, rankingResetAt: null, usdtRateAoa: 0, usdtWallet: null, usdtMinDeposit: 13, largeTradePushThreshold: 0, largeWithdrawalThreshold: 0, dailyLossLimitPct: 0, depositBonusActive: false, depositBonusPct: 10, depositBonusMinAoa: 50000, depositBonusType: "first" };
export async function loadSettings() { settings = await getSettings(); return settings; }
