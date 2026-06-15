import { SYNTHETIC_LABEL_TO_SYMBOL } from "./derivWebSocket";
import { fetchDerivLatestTickWS, fetchDerivCandlesWS } from "./derivServerWS";

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

async function fetchDerivSymbolPrice(symbol: string): Promise<number | null> {
  try {
    // Tick mais recente — sem atraso de vela de 60s
    const tick = await fetchDerivLatestTickWS(symbol);
    if (tick && tick > 0) return tick;
  } catch { /* fallback para vela abaixo */ }
  try {
    // Fallback: fecho da última vela de 60s
    const candles = await fetchDerivCandlesWS(symbol, 60, 1);
    if (candles.length > 0) return candles[candles.length - 1].close;
  } catch { /* silent */ }
  return null;
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
