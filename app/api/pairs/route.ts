import { NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";
import { CRYPTO_PAIRS, type DerivPair } from "@/lib/derivWebSocket";

export async function GET() {
  const { activePairs } = await getSettings();
  const allowed = new Set(activePairs);

  // Só pares Binance — disponíveis 24/7
  // Se activePairs tem labels antigos (forex) que não coincidem, mostra todos os crypto
  const filtered = CRYPTO_PAIRS.filter(p => allowed.has(p.label));
  const pairs: DerivPair[] = filtered.length > 0 ? filtered : CRYPTO_PAIRS;

  return NextResponse.json({ pairs, marketOpen: true });
}
