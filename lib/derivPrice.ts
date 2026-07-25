// Preços de activos via Binance REST (crypto, 24/7)
// Mantém o nome "derivPrice" por compatibilidade com imports existentes

import { ASSET_TO_BINANCE_SYMBOL, BINANCE_SYMBOL_TO_COINGECKO_ID } from "@/lib/assets";

// Deduplicação de pedidos em curso: evita chamadas duplicadas quando o worker
// resolve várias operações do mesmo activo em paralelo (Promise.all na mesma
// invocação). NÃO é uma cache por tempo — instâncias serverless na Vercel
// podem ficar "quentes" e sobreviver entre pedidos HTTP diferentes, por isso
// uma cache com TTL a nível de módulo devolveria preços desactualizados entre
// pedidos, o que é inaceitável ao resolver operações com dinheiro real.
const _inFlight = new Map<string, Promise<number | null>>();

async function fetchWithTimeout(url: string, timeoutMs = 4500): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    return res;
  } finally {
    clearTimeout(id);
  }
}

// Usa /api/v3/trades (última transacção real, com timestamp) em vez de
// /api/v3/ticker/price. Confirmado directamente (2026-07-25): ticker/price
// devolve o mesmo valor, ao cêntimo, em chamadas sucessivas ao longo de
// dezenas de segundos, mesmo com round-trip < 1,5s — parece ter um ciclo de
// actualização próprio do lado da Binance, independente de quão depressa o
// consultamos. /api/v3/trades?limit=1 devolve sempre a última execução real
// (id de trade diferente em cada chamada, confirmado), e vem com `time` em
// ms — isso é o que fazia o preço gravado no servidor parecer "congelado"
// enquanto o gráfico do cliente (WebSocket @trade, esse sim por-trade) já
// tinha claramente andado.
async function fetchBinancePrice(symbol: string): Promise<number | null> {
  // Tenta os dois endpoints Binance (global + US)
  const urls = [
    `https://api.binance.com/api/v3/trades?symbol=${symbol}&limit=1`,
    `https://api.binance.us/api/v3/trades?symbol=${symbol}&limit=1`,
  ];
  for (const url of urls) {
    try {
      const res = await fetchWithTimeout(url, 4000);
      if (!res.ok) continue;
      const data = await res.json() as { price: string }[];
      const price = parseFloat(data?.[0]?.price ?? "");
      if (isFinite(price) && price > 0) return price;
    } catch { /* tenta próximo */ }
  }
  return null;
}

// Coinbase — API pública sem restrições geográficas, boa cobertura global
async function fetchCoinbasePrice(asset: string): Promise<number | null> {
  // "BTC/USD" → "BTC-USD"
  const pair = asset.replace("/", "-");
  try {
    const res = await fetchWithTimeout(
      `https://api.coinbase.com/v2/prices/${pair}/spot`,
      5000,
    );
    if (!res.ok) return null;
    const data = await res.json() as { data?: { amount: string } };
    const price = parseFloat(data.data?.amount ?? "");
    return isFinite(price) && price > 0 ? price : null;
  } catch { return null; }
}

async function fetchCoinGeckoPrice(symbol: string): Promise<number | null> {
  const id = BINANCE_SYMBOL_TO_COINGECKO_ID[symbol];
  if (!id) return null;
  try {
    const res = await fetchWithTimeout(
      `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`,
      5000,
    );
    if (!res.ok) return null;
    const data = await res.json() as Record<string, { usd: number }>;
    const price = data[id]?.usd;
    return typeof price === "number" && price > 0 ? price : null;
  } catch { return null; }
}

export async function getDerivPrice(asset: string): Promise<number | null> {
  const sym = ASSET_TO_BINANCE_SYMBOL[asset];
  if (!sym) return null;

  // Já existe um pedido em curso para este activo (ex.: várias operações do
  // mesmo activo a resolver em paralelo) — partilha a mesma promise em vez de
  // disparar pedidos HTTP duplicados.
  const existing = _inFlight.get(asset);
  if (existing) return existing;

  const fetchPromise = (async (): Promise<number | null> => {
    try {
      // 1. Binance (global + US)
      const binancePrice = await fetchBinancePrice(sym);
      if (binancePrice) return binancePrice;

      // 2. Coinbase — sem restrições geográficas (fallback principal)
      // Binance falhou (bloqueio/rate-limit de IP de datacenter é comum) — regista
      // para diagnóstico, já que o Coinbase/CoinGecko actualizam com menos frequência.
      console.warn(`[derivPrice] Binance falhou para ${sym} — a usar fallback`);
      const coinbasePrice = await fetchCoinbasePrice(asset);
      if (coinbasePrice) return coinbasePrice;

      // 3. CoinGecko como último fallback
      console.warn(`[derivPrice] Coinbase também falhou para ${asset} — a usar CoinGecko`);
      return await fetchCoinGeckoPrice(sym);
    } finally {
      // Remove assim que resolve — nunca serve um preço antigo a um pedido futuro
      _inFlight.delete(asset);
    }
  })();

  _inFlight.set(asset, fetchPromise);
  return fetchPromise;
}

// ── Variante com fonte anexada — usada pela abertura de operações para poder
// auditar/rejeitar por proveniência (ver app/api/trade/route.ts). Duplica a
// cascata em vez de alterar getDerivPrice(), para não mudar o contrato dessa
// função para os restantes consumidores (ex.: resolveExpiredTrade.ts).
export type DerivPriceSource = "binance" | "coinbase" | "coingecko";

const _inFlightWithSource = new Map<string, Promise<{ price: number; source: DerivPriceSource } | null>>();

export async function getDerivPriceWithSource(
  asset: string,
): Promise<{ price: number; source: DerivPriceSource } | null> {
  const sym = ASSET_TO_BINANCE_SYMBOL[asset];
  if (!sym) return null;

  const existing = _inFlightWithSource.get(asset);
  if (existing) return existing;

  const fetchPromise = (async (): Promise<{ price: number; source: DerivPriceSource } | null> => {
    try {
      const binancePrice = await fetchBinancePrice(sym);
      if (binancePrice) return { price: binancePrice, source: "binance" };

      console.warn(`[derivPrice] Binance falhou para ${sym} — a usar fallback`);
      const coinbasePrice = await fetchCoinbasePrice(asset);
      if (coinbasePrice) return { price: coinbasePrice, source: "coinbase" };

      console.warn(`[derivPrice] Coinbase também falhou para ${asset} — a usar CoinGecko`);
      const cgPrice = await fetchCoinGeckoPrice(sym);
      if (cgPrice) return { price: cgPrice, source: "coingecko" };
      return null;
    } finally {
      _inFlightWithSource.delete(asset);
    }
  })();

  _inFlightWithSource.set(asset, fetchPromise);
  return fetchPromise;
}
