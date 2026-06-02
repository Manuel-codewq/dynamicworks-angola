import { SYNTHETIC_LABEL_TO_SYMBOL } from "./derivWebSocket";

const ASSET_TO_SYMBOL: Record<string, string> = {
  "EUR/USD": "frxEURUSD", "GBP/USD": "frxGBPUSD", "USD/JPY": "frxUSDJPY",
  "AUD/USD": "frxAUDUSD", "USD/CAD": "frxUSDCAD", "EUR/GBP": "frxEURGBP",
  "USD/CHF": "frxUSDCHF", "NZD/USD": "frxNZDUSD", "EUR/JPY": "frxEURJPY",
  "GBP/JPY": "frxGBPJPY", "EUR/CAD": "frxEURCAD", "AUD/JPY": "frxAUDJPY",
  "GBP/AUD": "frxGBPAUD", "EUR/CHF": "frxEURCHF", "AUD/CAD": "frxAUDCAD",
  "AUD/CHF": "frxAUDCHF", "AUD/NZD": "frxAUDNZD", "EUR/AUD": "frxEURAUD",
  "EUR/NZD": "frxEURNZD", "GBP/CAD": "frxGBPCAD", "GBP/CHF": "frxGBPCHF",
  "GBP/NOK": "frxGBPNOK", "GBP/NZD": "frxGBPNZD", "NZD/JPY": "frxNZDJPY",
  "USD/MXN": "frxUSDMXN", "USD/NOK": "frxUSDNOK", "USD/PLN": "frxUSDPLN",
  "USD/SEK": "frxUSDSEK", "BTC/USD": "cryBTCUSD", "ETH/USD": "cryETHUSD",
  "Prata/USD": "frxXAGUSD", "Paládio/USD": "frxXPDUSD", "Platina/USD": "frxXPTUSD",
  "XAG/USD": "frxXAGUSD",
};

export function isOtcAsset(asset: string): boolean {
  return typeof asset === "string" && asset.endsWith(" OTC");
}

// Mesmo formato que o price-recorder — comprovado a funcionar
async function fetchDerivSymbolPrice(symbol: string): Promise<number | null> {
  try {
    const url = `https://api.deriv.com/api/v1/ticks_history` +
      `?ticks_history=${symbol}&count=1&end=latest&style=candles&granularity=60`;
    const res = await fetch(url, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = await res.json();
    const candles: any[] = json?.candles ?? json?.history?.candles ?? [];
    if (candles.length === 0) return null;
    const close = parseFloat(candles[candles.length - 1]?.close);
    return isFinite(close) && close > 0 ? close : null;
  } catch {
    return null;
  }
}

export async function getDerivPrice(asset: string, forceReal = false): Promise<number | null> {
  const synthSymbol = SYNTHETIC_LABEL_TO_SYMBOL[asset];

  // OTC/sintéticos: usar sempre o índice Deriv, independente do horário de mercado
  if (synthSymbol && !forceReal) {
    return fetchDerivSymbolPrice(synthSymbol);
  }

  // Pares reais
  const symbol = ASSET_TO_SYMBOL[asset];
  if (!symbol) return null;
  return fetchDerivSymbolPrice(symbol);
}
