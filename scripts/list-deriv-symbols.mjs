import WebSocket from "ws";

const ws = new WebSocket("wss://ws.binaryws.com/websockets/v3?app_id=127916");

ws.on("open", () => {
  ws.send(JSON.stringify({ active_symbols: "brief", product_type: "basic" }));
});

ws.on("message", (raw) => {
  const msg = JSON.parse(raw.toString());
  if (!msg.active_symbols) return;

  // Filtrar apenas sintéticos (não forex, não cripto, não stocks)
  const synthetic = msg.active_symbols.filter(s =>
    s.market === "synthetic_index" || s.submarket_display_name?.toLowerCase().includes("step") ||
    s.submarket_display_name?.toLowerCase().includes("slope") ||
    s.submarket_display_name?.toLowerCase().includes("volatility") ||
    s.submarket_display_name?.toLowerCase().includes("jump")
  );

  console.log("=== Índices Sintéticos Deriv ===\n");

  // Agrupar por submarket
  const groups = {};
  synthetic.forEach(s => {
    const g = s.submarket_display_name ?? "Outro";
    if (!groups[g]) groups[g] = [];
    groups[g].push({ symbol: s.symbol, name: s.display_name, is_open: s.exchange_is_open });
  });

  Object.entries(groups).forEach(([group, items]) => {
    console.log(`\n[${group}]`);
    items.forEach(i => console.log(`  ${i.symbol.padEnd(15)} ${i.name}  ${i.is_open ? "🟢" : "🔴"}`));
  });

  ws.close();
  process.exit(0);
});
