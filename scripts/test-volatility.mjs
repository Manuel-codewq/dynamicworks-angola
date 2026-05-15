import WebSocket from "ws";

const ws = new WebSocket("wss://ws.binaryws.com/websockets/v3?app_id=127916");
let count = 0;

ws.on("open", () => {
  console.log("A testar Volatility Indices 24/7...\n");
  ws.send(JSON.stringify({ ticks: "R_10", subscribe: 1 }));
  ws.send(JSON.stringify({ ticks: "R_75", subscribe: 1 }));
  setTimeout(() => { ws.close(); process.exit(0); }, 8000);
});

ws.on("message", (raw) => {
  const msg = JSON.parse(raw.toString());
  if (msg.tick) {
    console.log(`✅ ${msg.tick.symbol} = ${msg.tick.quote}`);
    if (++count >= 6) { ws.close(); process.exit(0); }
  }
  if (msg.error) console.log(`❌ ${msg.tick?.symbol ?? "?"}: ${msg.error.message}`);
});
