import { prisma } from "./prisma";

const ALL_PAIRS = [
  // Forex
  "EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD",
  "USD/CAD", "EUR/GBP", "USD/CHF", "NZD/USD",
  "EUR/JPY", "GBP/JPY", "EUR/CAD", "AUD/JPY", "GBP/AUD", "EUR/CHF",
  // Cripto
  "BTC/USD", "ETH/USD",
  // Commodities
  "XAU/USD", "XAG/USD",
  // Índices DW (24/7)
  "DW Index 10", "DW Index 25", "DW Index 50", "DW Index 75", "DW Index 100",
] as const;

export const DEFAULT_PAYOUT          = Object.fromEntries(ALL_PAIRS.map(p => [p, 0.85]));
export const DEFAULT_WIN_PROBABILITY = Object.fromEntries(ALL_PAIRS.map(p => [p, 0.47]));

export interface PlatformSettings {
  payout:          Record<string, number>;
  winProbability:  Record<string, number>;
  maintenanceMode: boolean;
}

// In-memory cache to avoid hitting DB on every request within same instance
let cache: PlatformSettings | null = null;

export async function getSettings(): Promise<PlatformSettings> {
  if (cache) return cache;
  try {
    const row = await prisma.settings.upsert({
      where:  { id: "singleton" },
      create: { id: "singleton", maintenanceMode: false, payout: DEFAULT_PAYOUT, winProbability: DEFAULT_WIN_PROBABILITY },
      update: {},
    });
    cache = {
      maintenanceMode: row.maintenanceMode,
      payout:          { ...DEFAULT_PAYOUT,          ...(row.payout          as Record<string, number> ?? {}) },
      winProbability:  { ...DEFAULT_WIN_PROBABILITY, ...(row.winProbability  as Record<string, number> ?? {}) },
    };
    return cache;
  } catch {
    return { maintenanceMode: false, payout: DEFAULT_PAYOUT, winProbability: DEFAULT_WIN_PROBABILITY };
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

  await prisma.settings.upsert({
    where:  { id: "singleton" },
    create: { id: "singleton", ...current },
    update: { maintenanceMode: current.maintenanceMode, payout: current.payout, winProbability: current.winProbability },
  });

  cache = current;
  return current;
}

// Synchronous fallback used by trade/worker routes that already have settings loaded
export let settings: PlatformSettings = { maintenanceMode: false, payout: DEFAULT_PAYOUT, winProbability: DEFAULT_WIN_PROBABILITY };
export async function loadSettings() { settings = await getSettings(); return settings; }
