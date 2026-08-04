import { prisma } from "./prisma";
import { ASSET_LABELS, PAYOUT_DURATION_KEYS } from "./assets";

export const ALL_REAL_PAIR_LABELS = ASSET_LABELS as string[];

// Payout aninhado por duração (2026-07-30) — cada par tem um mapa
// duração(segundos, como string)→payout, mais uma chave "default" para
// durações fora do mapa. Ver PAYOUT_DURATIONS em lib/assets.ts.
const DEFAULT_PAYOUT_ENTRY: Record<string, number> = Object.fromEntries(PAYOUT_DURATION_KEYS.map(k => [k, 0.85]));
export const DEFAULT_PAYOUT: Record<string, Record<string, number>> =
  Object.fromEntries(ASSET_LABELS.map(p => [p, { ...DEFAULT_PAYOUT_ENTRY }]));

/**
 * Normaliza uma entrada de payout guardada na BD para o formato aninhado
 * actual. Aceita também o formato antigo (número simples, um payout só por
 * par) — nesse caso aplica esse valor a todas as durações, para continuar a
 * funcionar mesmo que o script de migração ainda não tenha corrido nalgum
 * ambiente. Chaves de duração desconhecidas são ignoradas.
 */
function normalizePayoutEntry(raw: unknown): Record<string, number> {
  if (typeof raw === "number" && isFinite(raw) && raw >= 0.50 && raw <= 0.95) {
    return Object.fromEntries(PAYOUT_DURATION_KEYS.map(k => [k, raw]));
  }
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const out = { ...DEFAULT_PAYOUT_ENTRY };
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (!PAYOUT_DURATION_KEYS.includes(k)) continue;
      const n = Number(v);
      if (isFinite(n) && n >= 0.50 && n <= 0.95) out[k] = n;
    }
    return out;
  }
  return { ...DEFAULT_PAYOUT_ENTRY };
}

export const DEFAULT_WIN_PROBABILITY = Object.fromEntries(ASSET_LABELS.map(p => [p, 0.47]));
export const DEFAULT_RANKING_RESET: Date | null = null;
export const DEFAULT_WEEKEND_PAIRS: string[] = [];
export const DEFAULT_ACTIVE_PAIRS    = ALL_REAL_PAIR_LABELS;

export const ALL_PAIR_KEYS = ASSET_LABELS as string[];

export interface PlatformSettings {
  payout:          Record<string, Record<string, number>>;
  winProbability:  Record<string, number>;
  maintenanceMode: boolean;
  forceRealMarket: boolean;
  activePairs:     string[];
  weekendPairs:    string[];
  rankingResetAt:  Date | null;
  largeTradePushThreshold:  number;
  largeWithdrawalThreshold: number;
  dailyLossLimitPct:        number;
  houseDailyLossLimit:      number;
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
      create: { id: "singleton", maintenanceMode: false, forceRealMarket: false, payout: DEFAULT_PAYOUT, winProbability: DEFAULT_WIN_PROBABILITY, activePairs: DEFAULT_ACTIVE_PAIRS, weekendPairs: DEFAULT_WEEKEND_PAIRS, rankingResetAt: null, largeTradePushThreshold: 0, largeWithdrawalThreshold: 0, dailyLossLimitPct: 0, houseDailyLossLimit: 0 },
      update: {},
    }) as any;
    const savedPairs        = Array.isArray(row.activePairs)  ? row.activePairs  as string[] : null;
    const savedWeekendPairs = Array.isArray(row.weekendPairs) ? row.weekendPairs as string[] : null;
    const validKeys = new Set<string>(ASSET_LABELS);
    const rawPayout = (row.payout as Record<string, unknown>) ?? {};
    const rawWinProb = (row.winProbability as Record<string, number>) ?? {};
    cache = {
      maintenanceMode: row.maintenanceMode,
      forceRealMarket: row.forceRealMarket ?? false,
      payout:         Object.fromEntries(ASSET_LABELS.map(label => [label, normalizePayoutEntry(rawPayout[label])])),
      winProbability: { ...DEFAULT_WIN_PROBABILITY, ...Object.fromEntries(Object.entries(rawWinProb).filter(([k]) => validKeys.has(k))) },
      // Pares gravados na BD + qualquer label novo em ASSET_LABELS que ainda
      // não lá esteja (ex: instrumentos adicionados depois da última vez que
      // isto foi guardado) — novos pares entram activos por omissão, sem
      // apagar nenhuma desactivação que o admin já tenha feito nos pares
      // existentes. Sem isto, um par novo com active:true em lib/assets.ts
      // continua invisível em /api/pairs até alguém gravar as definições
      // manualmente no admin.
      activePairs:     savedPairs !== null
        ? [...savedPairs, ...ASSET_LABELS.filter(l => !savedPairs!.includes(l))]
        : DEFAULT_ACTIVE_PAIRS,
      weekendPairs:    savedWeekendPairs !== null ? savedWeekendPairs : DEFAULT_WEEKEND_PAIRS,
      rankingResetAt:  row.rankingResetAt ? new Date(row.rankingResetAt) : null,
      largeTradePushThreshold:  Number(row.largeTradePushThreshold ?? 0),
      largeWithdrawalThreshold: Number(row.largeWithdrawalThreshold ?? 0),
      dailyLossLimitPct:        Number(row.dailyLossLimitPct ?? 0),
      houseDailyLossLimit:      Number(row.houseDailyLossLimit ?? 0),
      depositBonusActive:       Boolean(row.depositBonusActive ?? false),
      depositBonusPct:          Number(row.depositBonusPct ?? 10),
      depositBonusMinAoa:       Number(row.depositBonusMinAoa ?? 50000),
      depositBonusType:         (row.depositBonusType === "all" ? "all" : "first") as "first" | "all",
    };
    cacheAt = Date.now();
    return cache;
  } catch {
    return { maintenanceMode: false, forceRealMarket: false, payout: DEFAULT_PAYOUT, winProbability: DEFAULT_WIN_PROBABILITY, activePairs: DEFAULT_ACTIVE_PAIRS, weekendPairs: DEFAULT_WEEKEND_PAIRS, rankingResetAt: null, largeTradePushThreshold: 0, largeWithdrawalThreshold: 0, dailyLossLimitPct: 0, houseDailyLossLimit: 0, depositBonusActive: false, depositBonusPct: 10, depositBonusMinAoa: 50000, depositBonusType: "first" as const };
  }
}

export async function updateSettings(patch: Partial<PlatformSettings>): Promise<PlatformSettings> {
  const current = await getSettings();

  if (patch.payout && typeof patch.payout === "object") {
    Object.entries(patch.payout).forEach(([label, durMap]) => {
      if (!current.payout[label] || !durMap || typeof durMap !== "object") return;
      Object.entries(durMap as Record<string, unknown>).forEach(([durKey, v]) => {
        if (!PAYOUT_DURATION_KEYS.includes(durKey)) return;
        const n = Number(v);
        if (isFinite(n) && n >= 0.50 && n <= 0.95) current.payout[label][durKey] = n;
      });
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
  if (typeof patch.largeTradePushThreshold === "number" && isFinite(patch.largeTradePushThreshold) && patch.largeTradePushThreshold >= 0) current.largeTradePushThreshold = patch.largeTradePushThreshold;
  if (typeof patch.largeWithdrawalThreshold === "number" && isFinite(patch.largeWithdrawalThreshold) && patch.largeWithdrawalThreshold >= 0) current.largeWithdrawalThreshold = patch.largeWithdrawalThreshold;
  if (typeof patch.dailyLossLimitPct === "number" && isFinite(patch.dailyLossLimitPct) && patch.dailyLossLimitPct >= 0 && patch.dailyLossLimitPct <= 100) current.dailyLossLimitPct = patch.dailyLossLimitPct;
  if (typeof patch.houseDailyLossLimit === "number" && isFinite(patch.houseDailyLossLimit) && patch.houseDailyLossLimit >= 0) current.houseDailyLossLimit = patch.houseDailyLossLimit;
  if (typeof patch.depositBonusActive === "boolean") current.depositBonusActive = patch.depositBonusActive;
  if (typeof patch.depositBonusPct === "number" && isFinite(patch.depositBonusPct) && patch.depositBonusPct >= 0 && patch.depositBonusPct <= 100) current.depositBonusPct = patch.depositBonusPct;
  if (typeof patch.depositBonusMinAoa === "number" && isFinite(patch.depositBonusMinAoa) && patch.depositBonusMinAoa >= 0) current.depositBonusMinAoa = patch.depositBonusMinAoa;
  if (patch.depositBonusType === "first" || patch.depositBonusType === "all") current.depositBonusType = patch.depositBonusType;

  await (prisma.settings.upsert as any)({
    where:  { id: "singleton" },
    create: { id: "singleton", ...current },
    update: { maintenanceMode: current.maintenanceMode, forceRealMarket: current.forceRealMarket, payout: current.payout, winProbability: current.winProbability, activePairs: current.activePairs, weekendPairs: current.weekendPairs, rankingResetAt: current.rankingResetAt, largeTradePushThreshold: current.largeTradePushThreshold, largeWithdrawalThreshold: current.largeWithdrawalThreshold, dailyLossLimitPct: current.dailyLossLimitPct, houseDailyLossLimit: current.houseDailyLossLimit, depositBonusActive: current.depositBonusActive, depositBonusPct: current.depositBonusPct, depositBonusMinAoa: current.depositBonusMinAoa, depositBonusType: current.depositBonusType },
  });

  cache = current;
  cacheAt = Date.now();
  return current;
}

// Synchronous fallback used by trade/worker routes that already have settings loaded
export let settings: PlatformSettings = { maintenanceMode: false, forceRealMarket: false, payout: DEFAULT_PAYOUT, winProbability: DEFAULT_WIN_PROBABILITY, activePairs: DEFAULT_ACTIVE_PAIRS, weekendPairs: DEFAULT_WEEKEND_PAIRS, rankingResetAt: null, largeTradePushThreshold: 0, largeWithdrawalThreshold: 0, dailyLossLimitPct: 0, houseDailyLossLimit: 0, depositBonusActive: false, depositBonusPct: 10, depositBonusMinAoa: 50000, depositBonusType: "first" };
export async function loadSettings() { settings = await getSettings(); return settings; }
