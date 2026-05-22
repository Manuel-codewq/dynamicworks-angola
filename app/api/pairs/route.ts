import { NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";
import {
  FOREX_PAIRS, CRYPTO_PAIRS, COMMODITY_PAIRS,
  SYNTHETIC_PAIRS, isRealMarketOpen, type DerivPair,
} from "@/lib/derivWebSocket";

export async function GET() {
  const { activePairs, weekendPairs } = await getSettings();
  const marketOpen = isRealMarketOpen();

  const allowedReal    = new Set(activePairs);
  const allowedSynth   = new Set(weekendPairs);

  // Pares reais — só disponíveis durante horário de mercado
  const realPairs: DerivPair[] = marketOpen
    ? [...FOREX_PAIRS, ...CRYPTO_PAIRS, ...COMMODITY_PAIRS].filter(p => !allowedReal.size || allowedReal.has(p.label))
    : CRYPTO_PAIRS.filter(p => !allowedReal.size || allowedReal.has(p.label));

  // Pares sintéticos — sempre disponíveis (conforme config admin)
  const synthPairs: DerivPair[] = allowedSynth.size > 0
    ? SYNTHETIC_PAIRS.filter(p => allowedSynth.has(p.symbol))
    : SYNTHETIC_PAIRS;

  return NextResponse.json({ pairs: [...realPairs, ...synthPairs], marketOpen });
}
