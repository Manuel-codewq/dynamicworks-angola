import WebSocket from "ws";

const DERIV_WS_URL = "wss://ws.binaryws.com/websockets/v3?app_id=127916";
const TIMEOUT_MS   = 8_000;

/**
 * Fetches the latest spot price for a Deriv symbol from the server side.
 * Opens a fresh WS connection, waits for the first tick, then closes.
 * Returns null if the market is closed or the request times out.
 */
export async function getDerivPrice(symbol: string): Promise<number | null> {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (val: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws.close(); } catch { /* ignore */ }
      resolve(val);
    };

    const timer = setTimeout(() => settle(null), TIMEOUT_MS);

    const ws = new WebSocket(DERIV_WS_URL);

    ws.on("open", () => {
      ws.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
    });

    ws.on("message", (raw: WebSocket.RawData) => {
      try {
        const data = JSON.parse(raw.toString());
        if (data.error) { settle(null); return; }
        if (data.tick?.quote) {
          const price = typeof data.tick.quote === "number"
            ? data.tick.quote
            : parseFloat(data.tick.quote);
          settle(isFinite(price) && price > 0 ? price : null);
        }
      } catch { /* malformed frame — wait for next */ }
    });

    ws.on("error", () => settle(null));
    ws.on("close", () => settle(null));
  });
}
