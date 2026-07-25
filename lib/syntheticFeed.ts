// Preços de activos via synthetic-engine (serviço interno, ver
// synthetic-engine/) — substitui lib/derivPrice.ts (Binance/Coinbase/
// CoinGecko, usadas até 2026-07-25).
//
// Fonte única, sem cascata de fallback: ao contrário de uma API externa de
// terceiros, o synthetic-engine é um serviço próprio na mesma rede — se não
// responder, não há um "segundo fornecedor" plausível para tentar a seguir,
// só falhar de forma visível (ver getDerivPrice() → null → 503 em quem chama).

import { ASSET_TO_SYNTHETIC_SYMBOL } from "@/lib/assets";

const SYNTHETIC_ENGINE_URL = process.env.SYNTHETIC_ENGINE_URL ?? "http://localhost:4001";

async function fetchWithTimeout(url: string, timeoutMs = 4000): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: ctrl.signal, cache: "no-store" });
  } finally {
    clearTimeout(id);
  }
}

type IndexEntry = { symbol: string; displayName: string; type: string; lastPrice: number; decimals: number };

// Deduplicação de pedidos em curso — mesmo motivo que lib/derivPrice.ts
// tinha: evita pedidos duplicados quando várias operações do mesmo lote
// pedem preço ao mesmo tempo. Sem TTL: cada invocação da função serverless
// arranca com este módulo "frio", por isso nunca serve um preço de uma
// invocação anterior.
let inFlight: Promise<IndexEntry[]> | null = null;

async function fetchIndices(): Promise<IndexEntry[]> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const res = await fetchWithTimeout(`${SYNTHETIC_ENGINE_URL}/api/indices`);
      if (!res.ok) throw new Error(`synthetic-engine /api/indices: HTTP ${res.status}`);
      return await res.json() as IndexEntry[];
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** Preço "agora" de um activo (label, ex: "EUR/USD OTC"). */
export async function getDerivPrice(asset: string): Promise<number | null> {
  const sym = ASSET_TO_SYNTHETIC_SYMBOL[asset];
  if (!sym) return null;
  try {
    const indices = await fetchIndices();
    const entry = indices.find(i => i.symbol === sym);
    return entry && entry.lastPrice > 0 ? entry.lastPrice : null;
  } catch { return null; }
}

/**
 * Preço "ancorado" a um instante — mantido por compatibilidade de interface
 * com o antigo lib/derivPrice.ts (lib/resolveExpiredTrade.ts chama isto para
 * determinar o preço de fecho de uma operação expirada).
 *
 * LIMITAÇÃO CONHECIDA: o synthetic-engine não expõe histórico de ticks por
 * timestamp (só GET /api/indices/:symbol/candles, granularidade 1m) — por
 * isso isto devolve o preço "agora" (mesmo comportamento de getDerivPrice()),
 * tal como já acontecia para a Binance antes do fix de hoje (494e83c) para o
 * caminho instantâneo. Na prática isto é preciso na esmagadora maioria dos
 * casos: o fecho é normalmente disparado pelo browser no mesmo segundo em
 * que a operação expira (app/api/trade/[id]/close), e "agora" ≈ "no instante
 * de expiração". Só degrada se o fecho for apanhado pelo worker de cron (até
 * ~59s de atraso — ver app/api/worker/route.ts), o que só acontece quando o
 * browser não disparou o fecho a tempo (aba fechada/em background). Resolver
 * isto por completo exigiria um endpoint de histórico por timestamp no
 * synthetic-engine — fora do âmbito desta migração.
 */
export async function getDerivPriceAt(asset: string, _timestampMs: number): Promise<number | null> {
  return getDerivPrice(asset);
}

export type DerivPriceSource = "synthetic";

// Mantido com esta forma (em vez de simplificar para só getDerivPrice) para
// não obrigar a mudar a assinatura em quem já consome isto (app/api/trade/route.ts).
export async function getDerivPriceWithSource(
  asset: string,
): Promise<{ price: number; source: DerivPriceSource } | null> {
  const price = await getDerivPrice(asset);
  return price !== null ? { price, source: "synthetic" } : null;
}
