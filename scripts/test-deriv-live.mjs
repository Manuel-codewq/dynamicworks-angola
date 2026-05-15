import WebSocket from "ws";

const ws = new WebSocket("wss://ws.binaryws.com/websockets/v3?app_id=127916");

ws.on("open", () => {
  console.log("Ligado ao Deriv. A subscrever EUR/USD...");
  ws.send(JSON.stringify({ ticks: "frxEURUSD", subscribe: 1 }));

  // Timeout após 15s
  setTimeout(() => {
    console.log("\nSem ticks ao vivo — mercado fechado no Deriv.");
    ws.close();
    process.exit(0);
  }, 15000);
});

ws.on("message", (raw) => {
  const msg = JSON.parse(raw.toString());
  if (msg.tick) {
    console.log(`✅ Tick ao vivo: EUR/USD = ${msg.tick.quote} @ ${new Date(msg.tick.epoch * 1000).toLocaleTimeString()}`);
  }
  if (msg.error) {
    console.log(`❌ Erro: ${msg.error.message}`);
  }
});
