import WebSocket from "ws";

const DERIV_WS_URL = "wss://ws.binaryws.com/websockets/v3?app_id=127916";

const PAIRS = [
  ["EUR/USD", "frxEURUSD"], ["GBP/USD", "frxGBPUSD"], ["USD/JPY", "frxUSDJPY"],
  ["AUD/USD", "frxAUDUSD"], ["USD/CAD", "frxUSDCAD"], ["EUR/GBP", "frxEURGBP"],
  ["USD/CHF", "frxUSDCHF"], ["NZD/USD", "frxNZDUSD"], ["EUR/JPY", "frxEURJPY"],
  ["GBP/JPY", "frxGBPJPY"], ["EUR/CAD", "frxEURCAD"], ["AUD/JPY", "frxAUDJPY"],
  ["GBP/AUD", "frxGBPAUD"], ["EUR/CHF", "frxEURCHF"], ["AUD/CAD", "frxAUDCAD"],
  ["AUD/CHF", "frxAUDCHF"], ["AUD/NZD", "frxAUDNZD"], ["EUR/AUD", "frxEURAUD"],
  ["EUR/NZD", "frxEURNZD"], ["GBP/CAD", "frxGBPCAD"], ["GBP/CHF", "frxGBPCHF"],
  ["GBP/NOK", "frxGBPNOK"], ["GBP/NZD", "frxGBPNZD"], ["NZD/JPY", "frxNZDJPY"],
  ["USD/MXN", "frxUSDMXN"], ["USD/NOK", "frxUSDNOK"], ["USD/PLN", "frxUSDPLN"],
  ["USD/SEK", "frxUSDSEK"],
];

function fetchPrice(label, symbol) {
  return new Promise((resolve) => {
    const ws = new WebSocket(DERIV_WS_URL);
    const timeout = setTimeout(() => { ws.terminate(); resolve({ label, symbol, price: null }); }, 10000);
    ws.on("open", () => {
      ws.send(JSON.stringify({ ticks_history: symbol, count: 1, end: "latest", style: "ticks" }));
    });
    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.history?.prices?.length > 0) {
          clearTimeout(timeout);
          ws.terminate();
          resolve({ label, symbol, price: parseFloat(msg.history.prices[0]) });
        }
      } catch { clearTimeout(timeout); ws.terminate(); resolve({ label, symbol, price: null }); }
    });
    ws.on("error", () => { clearTimeout(timeout); resolve({ label, symbol, price: null }); });
  });
}

// Buscar em paralelo, 5 de cada vez
const results = [];
for (let i = 0; i < PAIRS.length; i += 5) {
  const batch = PAIRS.slice(i, i + 5);
  const res = await Promise.all(batch.map(([l, s]) => fetchPrice(l, s)));
  results.push(...res);
  process.stdout.write(".");
}

console.log("\n");
results.forEach(({ label, price }) => {
  if (price) console.log(`${label.padEnd(10)} ${price}`);
  else       console.log(`${label.padEnd(10)} ❌ sem dados`);
});
