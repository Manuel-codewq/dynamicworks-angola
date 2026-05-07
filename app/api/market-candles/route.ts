import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const GRANULARITY_MS: Record<string, number> = {
  "1m": 60_000, "5m": 300_000, "15m": 900_000, "1h": 3_600_000, "1D": 86_400_000,
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const asset     = searchParams.get("asset");
  const timeframe = searchParams.get("timeframe") ?? "1m";
  const count     = Math.min(parseInt(searchParams.get("count") ?? "150"), 500);

  if (!asset) return NextResponse.json({ error: "asset required" }, { status: 400 });

  const candles = await prisma.priceCandle.findMany({
    where:   { asset, timeframe },
    orderBy: { timestamp: "desc" },
    take:    count,
  });

  if (candles.length === 0) return NextResponse.json({ hasData: false, candles: [] });

  candles.reverse(); // ascending order

  // Shift timestamps so the last recorded candle aligns with "now"
  const granMs     = GRANULARITY_MS[timeframe] ?? 60_000;
  const lastRealMs = candles[candles.length - 1].timestamp.getTime();
  const nowMs      = Math.floor(Date.now() / granMs) * granMs;
  const shiftMs    = nowMs - lastRealMs;

  const shifted = candles.map(c => ({
    time:  Math.floor((c.timestamp.getTime() + shiftMs) / 1000),
    open:  c.open,
    high:  c.high,
    low:   c.low,
    close: c.close,
  }));

  // Average True Range — used by the frontend to calibrate OTC simulation volatility
  let totalRange = 0;
  for (const c of candles) totalRange += c.high - c.low;
  const avgATR = totalRange / candles.length;

  return NextResponse.json({
    hasData:   true,
    candles:   shifted,
    lastClose: candles[candles.length - 1].close,
    avgATR,
  });
}
