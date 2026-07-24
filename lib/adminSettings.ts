// Server-side singleton — persists for the lifetime of the Node.js process.
// In production use a DB-backed store; this is sufficient for the MVP.

const ALL_PAIRS = [
  "BTC/USD", "ETH/USD", "BNB/USD", "SOL/USD",
  "XRP/USD", "ADA/USD", "DOGE/USD", "LTC/USD",
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
