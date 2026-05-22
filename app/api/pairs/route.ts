import { NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";
import {
  FOREX_PAIRS, CRYPTO_PAIRS, COMMODITY_PAIRS,
  SYNTHETIC_PAIRS, isRealMarketOpen, type DerivPair,
} from "@/lib/derivWebSocket";

export async function GET() {
  const { weekendPairs } = await getSettings();
  const marketOpen = isRealMarketOpen();

  let pairs: DerivPair[];
  if (marketOpen) {
    pairs = [...FOREX_PAIRS, ...CRYPTO_PAIRS, ...COMMODITY_PAIRS];
  } else {
    const allowed = new Set(weekendPairs);
    const filtered = allowed.size > 0
      ? SYNTHETIC_PAIRS.filter(p => allowed.has(p.symbol))
      : SYNTHETIC_PAIRS;
    pairs = [...filtered, ...CRYPTO_PAIRS];
  }

  return NextResponse.json({ pairs, marketOpen });
}
