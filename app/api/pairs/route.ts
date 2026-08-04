import { NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";
import { CRYPTO_PAIRS, type DerivPair } from "@/lib/derivWebSocket";
import { getHouseRiskState } from "@/lib/houseRisk";
import { rotatePairsByDay } from "@/lib/assets";

export async function GET() {
  const [{ activePairs }, risk] = await Promise.all([getSettings(), getHouseRiskState()]);
  const allowed = new Set(activePairs);

  // Pares forex OTC sintéticos (synthetic-engine) — disponíveis 24/7
  // Se activePairs tem labels antigos que não coincidem, mostra todos os pares activos
  const filtered = CRYPTO_PAIRS.filter(p => allowed.has(p.label));
  const base: DerivPair[] = filtered.length > 0 ? filtered : CRYPTO_PAIRS;

  // A ordem roda por dia dentro de cada categoria — ver rotatePairsByDay().
  // Feito aqui (servidor) e não no cliente para não haver divergência de
  // hidratação entre a data do servidor e a do browser.
  const pairs = rotatePairsByDay(base);

  // Pares suspensos pela protecção da casa vão na lista à mesma, marcados —
  // remover um par faria o gráfico desaparecer debaixo de quem está a olhar
  // para ele. O bloqueio a sério é no servidor (app/api/trade/route.ts).
  return NextResponse.json({ pairs, marketOpen: true, suspendedPairs: risk.suspendedPairs });
}
