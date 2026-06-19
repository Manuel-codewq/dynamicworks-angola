import { NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";
import {
  FOREX_PAIRS, CRYPTO_PAIRS, COMMODITY_PAIRS,
  SYNTHETIC_PAIRS, isRealMarketOpen, type DerivPair,
} from "@/lib/derivWebSocket";

export async function GET() {
  const { activePairs, weekendPairs, forceRealMarket } = await getSettings();
  const marketOpen = forceRealMarket || isRealMarketOpen();

  const allowedReal    = new Set(activePairs);
  const allowedSynth   = new Set(weekendPairs);

  // Pares reais — lista vazia significa "nenhum par activo" (não "todos")
  const allReal = [...FOREX_PAIRS, ...CRYPTO_PAIRS, ...COMMODITY_PAIRS];
  const realPairs: DerivPair[] = marketOpen
    ? (allowedReal.size > 0 ? allReal.filter(p => allowedReal.has(p.label)) : [])
    : (allowedReal.size > 0 ? CRYPTO_PAIRS.filter(p => allowedReal.has(p.label)) : []);

  // Pares sintéticos — lista vazia significa "nenhum par activo"
  const synthPairs: DerivPair[] = allowedSynth.size > 0
    ? SYNTHETIC_PAIRS.filter(p => allowedSynth.has(p.symbol))
    : [];

  return NextResponse.json({ pairs: [...realPairs, ...synthPairs], marketOpen });
}
