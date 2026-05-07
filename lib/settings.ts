import { prisma } from "./prisma";

const ALL_PAIRS = [
  // Forex live
  "EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD",
  "USD/CAD", "EUR/GBP", "USD/CHF", "NZD/USD",
  "EUR/JPY", "GBP/JPY", "EUR/CAD", "AUD/JPY", "GBP/AUD", "EUR/CHF",
  // Forex OTC
  "EUR/USD (OTC)", "GBP/USD (OTC)", "USD/JPY (OTC)",
  "AUD/USD (OTC)", "USD/CAD (OTC)", "EUR/GBP (OTC)",
  "EUR/JPY (OTC)", "GBP/JPY (OTC)", "EUR/CAD (OTC)",
  "AUD/JPY (OTC)", "GBP/AUD (OTC)", "EUR/CHF (OTC)",
  // Crypto
  "BTC/USD", "ETH/USD",
  // Commodities
  "XAU/USD", "XAG/USD",
  // Synthetic
  "Volatility 10", "Volatility 25", "Volatility 50",
  "Volatility 75", "Volatility 100",
  "Boom 300", "Crash 300",
] as const;

export const DEFAULT_PAYOUT          = Object.fromEntries(ALL_PAIRS.map(p => [p, 0.85]));
export const DEFAULT_WIN_PROBABILITY = Object.fromEntries(ALL_PAIRS.map(p => [p, 0.47]));

export interface PlatformSettings {
  payout:          Record<string, number>;
  winProbability:  Record<string, number>;
  maintenanceMode: boolean;
  otcMode:         "auto" | "force_live" | "force_otc";
}

// In-memory cache to avoid hitting DB on every request within same instance
let cache: PlatformSettings | null = null;

export async function getSettings(): Promise<PlatformSettings> {
  if (cache) return cache;
  try {
    const row = await prisma.settings.upsert({
      where:  { id: "singleton" },
      create: { id: "singleton", otcMode: "auto", maintenanceMode: false, payout: DEFAULT_PAYOUT, winProbability: DEFAULT_WIN_PROBABILITY },
      update: {},
    });
    cache = {
      otcMode:         (row.otcMode as PlatformSettings["otcMode"]) ?? "auto",
      maintenanceMode: row.maintenanceMode,
      payout:          { ...DEFAULT_PAYOUT,          ...(row.payout          as Record<string, number> ?? {}) },
      winProbability:  { ...DEFAULT_WIN_PROBABILITY, ...(row.winProbability  as Record<string, number> ?? {}) },
    };
    return cache;
  } catch {
    // Fallback if DB unreachable
    return { otcMode: "auto", maintenanceMode: false, payout: DEFAULT_PAYOUT, winProbability: DEFAULT_WIN_PROBABILITY };
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
  if (patch.otcMode && ["auto", "force_live", "force_otc"].includes(patch.otcMode)) {
    current.otcMode = patch.otcMode;
  }

  await prisma.settings.upsert({
    where:  { id: "singleton" },
    create: { id: "singleton", ...current },
    update: { otcMode: current.otcMode, maintenanceMode: current.maintenanceMode, payout: current.payout, winProbability: current.winProbability },
  });

  cache = current;
  return current;
}

// Synchronous fallback used by trade/worker routes that already have settings loaded
export let settings: PlatformSettings = { otcMode: "auto", maintenanceMode: false, payout: DEFAULT_PAYOUT, winProbability: DEFAULT_WIN_PROBABILITY };
export async function loadSettings() { settings = await getSettings(); return settings; }
