import { SYNTHETIC_LABEL_TO_SYMBOL, isRealMarketOpen } from "./derivWebSocket";

const ASSET_TO_SYMBOL: Record<string, string> = {
  // Forex real
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
  // Sintéticos directos
  "1HZ10V": "1HZ10V", "1HZ25V": "1HZ25V", "1HZ50V": "1HZ50V",
  "1HZ75V": "1HZ75V", "1HZ100V": "1HZ100V",
  "R_10": "R_10", "R_25": "R_25", "R_50": "R_50", "R_75": "R_75", "R_100": "R_100",
  "RDBEAR": "RDBEAR", "RDBULL": "RDBULL",
  "WLDAUD": "WLDAUD", "WLDEUR": "WLDEUR", "WLDGBP": "WLDGBP",
  "WLDUSD": "WLDUSD", "WLDXAU": "WLDXAU",
};

export function isOtcAsset(_asset: string): boolean {
  return false;
}

// HTTP REST — mais fiável que WebSocket em ambiente serverless
async function fetchDerivSymbolPrice(symbol: string): Promise<number | null> {
  try {
    const url = `https://api.deriv.com/api/v1/ticks_history` +
      `?ticks_history=${symbol}&count=1&end=latest&style=ticks`;
    const res = await fetch(url, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const prices: string[] = json?.history?.prices ?? [];
    if (prices.length === 0) return null;
    const price = parseFloat(prices[prices.length - 1]);
    return isFinite(price) && price > 0 ? price : null;
  } catch {
    return null;
  }
}

export async function getDerivPrice(asset: string, forceReal = false): Promise<number | null> {
  const synthSymbol = SYNTHETIC_LABEL_TO_SYMBOL[asset];

  // Mercado fechado + par tem versão sintética + não forçado real → usar índice Deriv
  if (synthSymbol && !isRealMarketOpen() && !forceReal) {
    return fetchDerivSymbolPrice(synthSymbol);
  }

  const symbol = ASSET_TO_SYMBOL[asset];
  if (!symbol) return null;

  const price = await fetchDerivSymbolPrice(symbol);
  if (price) return price;

  // Fallback: tentar índice sintético se preço real falhou
  if (synthSymbol && synthSymbol !== symbol && !forceReal) {
    return fetchDerivSymbolPrice(synthSymbol);
  }

  return null;
}
