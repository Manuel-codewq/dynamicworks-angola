import { NextRequest, NextResponse } from "next/server";

// Proxy interno — o browser nunca fala directamente com o synthetic-engine
// (só acessível na rede interna/localhost do servidor), só com este endpoint
// same-origin. Usado por lib/derivWebSocket.ts (getCandles(), para o
// histórico do gráfico ao trocar de par/timeframe) — equivalente ao fetch
// directo que antes ia para api.binance.com/klines a partir do browser.
const SYNTHETIC_ENGINE_URL = process.env.SYNTHETIC_ENGINE_URL ?? "http://localhost:4001";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol    = searchParams.get("symbol");
  const timeframe = searchParams.get("timeframe") ?? "1m";
  const limit     = searchParams.get("limit") ?? "200";

  if (!symbol) {
    return NextResponse.json({ error: "symbol em falta" }, { status: 400 });
  }

  try {
    const url = `${SYNTHETIC_ENGINE_URL}/api/indices/${encodeURIComponent(symbol)}/candles?timeframe=${encodeURIComponent(timeframe)}&limit=${encodeURIComponent(limit)}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json({ error: "synthetic-engine indisponível" }, { status: 502 });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "synthetic-engine indisponível" }, { status: 502 });
  }
}
