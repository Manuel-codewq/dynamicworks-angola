import { NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";
import {
  FOREX_PAIRS, CRYPTO_PAIRS, COMMODITY_PAIRS,
  SYNTHETIC_PAIRS, isRealMarketOpen, type DerivPair,
} from "@/lib/derivWebSocket";

export async function GET() {
  const { activePairs, weekendPairs } = await getSettings();
  const marketOpen = isRealMarketOpen();

  let pairs: DerivPair[];
  if (marketOpen) {
    const allowed = new Set(activePairs);
    const allReal = [...FOREX_PAIRS, ...CRYPTO_PAIRS, ...COMMODITY_PAIRS];
    pairs = allowed.size > 0 ? allReal.filter(p => allowed.has(p.label)) : allReal;
  } else {
    const allowedWeekend = new Set(weekendPairs);
    const filtered = allowedWeekend.size > 0
      ? SYNTHETIC_PAIRS.filter(p => allowedWeekend.has(p.symbol))
      : SYNTHETIC_PAIRS;
    // Cripto é sempre 24/7; filtrar por activePairs também
    const allowedReal = new Set(activePairs);
    const crypto = allowedReal.size > 0
      ? CRYPTO_PAIRS.filter(p => allowedReal.has(p.label))
      : CRYPTO_PAIRS;
    pairs = [...filtered, ...crypto];
  }

  return NextResponse.json({ pairs, marketOpen });
}
