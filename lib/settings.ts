// Module-level singleton — shared across all requests in the same process.
// In serverless (Vercel), each instance has its own copy; settings reset on cold start.

const ALL_PAIRS = [
  // Live forex
  "EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD",
  "USD/CAD", "EUR/GBP", "USD/CHF", "NZD/USD",
  // OTC after-hours
  "EUR/USD (OTC)", "GBP/USD (OTC)", "USD/JPY (OTC)",
  "AUD/USD (OTC)", "USD/CAD (OTC)", "EUR/GBP (OTC)",
  // Synthetic / volatility indices
  "Volatility 10", "Volatility 25", "Volatility 50",
  "Volatility 75", "Volatility 100",
  "Boom 300", "Crash 300",
] as const;

export interface PlatformSettings {
  payout:          Record<string, number>;   // 0.50 – 0.95
  winProbability:  Record<string, number>;   // 0.30 – 0.60
  maintenanceMode: boolean;
  otcMode:         "auto" | "force_live" | "force_otc";
}

export const settings: PlatformSettings = {
  payout:         Object.fromEntries(ALL_PAIRS.map(p => [p, 0.85])),
  winProbability: Object.fromEntries(ALL_PAIRS.map(p => [p, 0.47])),
  maintenanceMode: false,
  otcMode:         "auto",
};

export function updateSettings(patch: Partial<PlatformSettings>): void {
  if (patch.payout && typeof patch.payout === "object") {
    Object.entries(patch.payout).forEach(([k, v]) => {
      const n = Number(v);
      if (isFinite(n) && n >= 0.50 && n <= 0.95) settings.payout[k] = n;
    });
  }
  if (patch.winProbability && typeof patch.winProbability === "object") {
    Object.entries(patch.winProbability).forEach(([k, v]) => {
      const n = Number(v);
      if (isFinite(n) && n >= 0.30 && n <= 0.60) settings.winProbability[k] = n;
    });
  }
  if (typeof patch.maintenanceMode === "boolean") {
    settings.maintenanceMode = patch.maintenanceMode;
  }
  if (patch.otcMode && ["auto", "force_live", "force_otc"].includes(patch.otcMode)) {
    settings.otcMode = patch.otcMode;
  }
}
