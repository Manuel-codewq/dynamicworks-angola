import WebSocket from "ws";
import { SYNTHETIC_LABEL_TO_SYMBOL, isRealMarketOpen } from "./derivWebSocket";

const DERIV_WS_URL = "wss://ws.binaryws.com/websockets/v3?app_id=127916";

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
  "Ouro/USD": "frxXAUUSD", "Prata/USD": "frxXAGUSD",
  "Paládio/USD": "frxXPDUSD", "Platina/USD": "frxXPTUSD",
  "XAU/USD": "frxXAUUSD", "XAG/USD": "frxXAGUSD",
  "DW Index 10": "R_10", "DW Index 25": "R_25", "DW Index 50": "R_50",
  "DW Index 75": "R_75", "DW Index 100": "R_100",
  // Índices Deriv directos (símbolo = símbolo Deriv)
  "1HZ10V": "1HZ10V", "1HZ25V": "1HZ25V", "1HZ50V": "1HZ50V",
  "1HZ75V": "1HZ75V", "1HZ100V": "1HZ100V",
  "R_10": "R_10", "R_25": "R_25", "R_50": "R_50", "R_75": "R_75", "R_100": "R_100",
};

export function isOtcAsset(_asset: string): boolean {
  return false; // Pares OTC removidos — todos os pares agora têm preço server-side
}

async function fetchDerivSymbolPrice(symbol: string): Promise<number | null> {
  return new Promise((resolve) => {
    let resolved = false;
    const done = (val: number | null) => {
      if (resolved) return;
      resolved = true;
      try { ws.terminate(); } catch {}
      resolve(val);
    };
    const ws = new WebSocket(DERIV_WS_URL);
    const timeout = setTimeout(() => done(null), 8000);
    ws.on("open", () => {
      ws.send(JSON.stringify({ ticks_history: symbol, count: 1, end: "latest", style: "ticks" }));
    });
    ws.on("message", (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.error) { clearTimeout(timeout); done(null); return; }
        if (Array.isArray(msg.history?.prices) && msg.history.prices.length > 0) {
          clearTimeout(timeout);
          const price = parseFloat(msg.history.prices[msg.history.prices.length - 1]);
          done(isFinite(price) && price > 0 ? price : null);
        }
      } catch { clearTimeout(timeout); done(null); }
    });
    ws.on("error", () => { clearTimeout(timeout); done(null); });
  });
}

export async function getDerivPrice(asset: string, forceReal = false): Promise<number | null> {
  const synthSymbol = SYNTHETIC_LABEL_TO_SYMBOL[asset];

  // Mercado fechado + par tem versão sintética + não forçado real → usar índice Deriv directamente
  if (synthSymbol && !isRealMarketOpen() && !forceReal) {
    return fetchDerivSymbolPrice(synthSymbol);
  }

  const symbol = ASSET_TO_SYMBOL[asset];
  if (!symbol) return null;

  const price = await fetchDerivSymbolPrice(symbol);
  if (price) return price;

  // Fallback: tentar índice sintético se preço real falhou (só quando mercado fechado sem override)
  if (synthSymbol && synthSymbol !== symbol && !forceReal) {
    return fetchDerivSymbolPrice(synthSymbol);
  }

  return null;
}
