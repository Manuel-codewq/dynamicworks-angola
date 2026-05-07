// Server-side singleton — persists for the lifetime of the Node.js process.
// In production use a DB-backed store; this is sufficient for the MVP.

const ALL_PAIRS = [
  "EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CAD", "EUR/GBP", "USD/CHF", "NZD/USD",
  "EUR/USD (OTC)", "GBP/USD (OTC)", "USD/JPY (OTC)", "AUD/USD (OTC)", "USD/CAD (OTC)", "EUR/GBP (OTC)",
  "Vol. 10", "Vol. 25", "Vol. 50", "Vol. 75", "Vol. 100", "Boom 300", "Crash 300",
];

export interface AdminSettings {
  payouts:          Record<string, number>;
  winProbabilities: Record<string, number>;
  maintenanceMode:  boolean;
  otcOverride:      "auto" | "force_otc" | "force_live";
}

export const adminSettings: AdminSettings = {
  payouts:          Object.fromEntries(ALL_PAIRS.map(p => [p, 85])),
  winProbabilities: Object.fromEntries(ALL_PAIRS.map(p => [p, 47])),
  maintenanceMode:  false,
  otcOverride:      "auto",
};
