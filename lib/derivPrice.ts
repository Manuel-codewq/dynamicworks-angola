import WebSocket from "ws";

const DERIV_WS_URL = "wss://ws.binaryws.com/websockets/v3?app_id=127916";

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
  "Ouro/USD": "frxXAUUSD", "Prata/USD": "frxXAGUSD",
  "Paládio/USD": "frxXPDUSD", "Platina/USD": "frxXPTUSD",
  "XAU/USD": "frxXAUUSD", "XAG/USD": "frxXAGUSD",
  "DW Index 10": "R_10", "DW Index 25": "R_25", "DW Index 50": "R_50",
  "DW Index 75": "R_75", "DW Index 100": "R_100",
};

// Pares OTC: label → base forex symbol
export const OTC_LABEL_TO_BASE: Record<string, string> = {
  "EUR/USD OTC": "frxEURUSD", "GBP/USD OTC": "frxGBPUSD", "USD/JPY OTC": "frxUSDJPY",
  "AUD/USD OTC": "frxAUDUSD", "USD/CAD OTC": "frxUSDCAD", "EUR/GBP OTC": "frxEURGBP",
  "USD/CHF OTC": "frxUSDCHF", "NZD/USD OTC": "frxNZDUSD", "EUR/JPY OTC": "frxEURJPY",
  "GBP/JPY OTC": "frxGBPJPY", "EUR/CAD OTC": "frxEURCAD", "AUD/JPY OTC": "frxAUDJPY",
  "GBP/AUD OTC": "frxGBPAUD", "EUR/CHF OTC": "frxEURCHF", "AUD/CAD OTC": "frxAUDCAD",
  "AUD/CHF OTC": "frxAUDCHF", "AUD/NZD OTC": "frxAUDNZD", "EUR/AUD OTC": "frxEURAUD",
  "EUR/NZD OTC": "frxEURNZD", "GBP/CAD OTC": "frxGBPCAD", "GBP/CHF OTC": "frxGBPCHF",
  "GBP/NOK OTC": "frxGBPNOK", "GBP/NZD OTC": "frxGBPNZD", "NZD/JPY OTC": "frxNZDJPY",
  "USD/MXN OTC": "frxUSDMXN", "USD/NOK OTC": "frxUSDNOK", "USD/PLN OTC": "frxUSDPLN",
  "USD/SEK OTC": "frxUSDSEK", "CAD/JPY OTC": "frxCADJPY", "CHF/JPY OTC": "frxCHFJPY",
};

export function isOtcAsset(asset: string): boolean {
  return asset in OTC_LABEL_TO_BASE;
}

export async function getDerivPrice(asset: string): Promise<number | null> {
  const symbol = ASSET_TO_SYMBOL[asset];
  if (!symbol) return null;

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
