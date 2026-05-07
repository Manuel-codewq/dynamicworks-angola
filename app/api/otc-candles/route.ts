import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const OTC_TO_LIVE: Record<string, string> = {
  "EUR/USD (OTC)": "EUR/USD",
  "GBP/USD (OTC)": "GBP/USD",
  "USD/JPY (OTC)": "USD/JPY",
  "AUD/USD (OTC)": "AUD/USD",
  "USD/CAD (OTC)": "USD/CAD",
  "EUR/GBP (OTC)": "EUR/GBP",
};

const VALID_TIMEFRAMES = ["1m", "5m", "15m", "1h"];
const MIN_CANDLES = 50;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const asset     = searchParams.get("asset")     ?? "";
  const timeframe = searchParams.get("timeframe") ?? "1m";
  const count     = Math.min(500, Math.max(10, parseInt(searchParams.get("count") ?? "150")));

  const liveAsset = OTC_TO_LIVE[asset];
  if (!liveAsset) {
    return NextResponse.json({ error: "Par OTC desconhecido" }, { status: 400 });
  }

  const tf = VALID_TIMEFRAMES.includes(timeframe) ? timeframe : "1m";

  const candles = await prisma.priceCandle.findMany({
    where:   { asset: liveAsset, timeframe: tf },
    orderBy: { timestamp: "desc" },
    take:    count,
    select:  { open: true, high: true, low: true, close: true, timestamp: true },
  });

  if (candles.length < MIN_CANDLES) {
    return NextResponse.json({ fallback: true, available: candles.length });
  }

  // Return ASC order for the chart
  const sorted = candles.reverse();
  return NextResponse.json(sorted);
}
