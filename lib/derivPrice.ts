// Preços de activos via Binance REST (crypto, 24/7)
// Mantém o nome "derivPrice" por compatibilidade com imports existentes

const BINANCE_ASSET_TO_SYMBOL: Record<string, string> = {
  "BTC/USD":  "BTCUSDT",
  "ETH/USD":  "ETHUSDT",
  "BNB/USD":  "BNBUSDT",
  "SOL/USD":  "SOLUSDT",
  "XRP/USD":  "XRPUSDT",
  "ADA/USD":  "ADAUSDT",
  "DOGE/USD": "DOGEUSDT",
  "LTC/USD":  "LTCUSDT",
};

// CoinGecko IDs usados como fallback se Binance falhar
const COINGECKO_IDS: Record<string, string> = {
  "BTCUSDT":  "bitcoin",
  "ETHUSDT":  "ethereum",
  "BNBUSDT":  "binancecoin",
  "SOLUSDT":  "solana",
  "XRPUSDT":  "ripple",
  "ADAUSDT":  "cardano",
  "DOGEUSDT": "dogecoin",
  "LTCUSDT":  "litecoin",
};

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

async function fetchBinancePrice(symbol: string): Promise<number | null> {
  // Tenta os dois endpoints Binance (global + US)
  const urls = [
    `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`,
    `https://api.binance.us/api/v3/ticker/price?symbol=${symbol}`,
  ];
  for (const url of urls) {
    try {
      const res = await fetchWithTimeout(url, 4000);
      if (!res.ok) continue;
      const data = await res.json() as { price: string };
      const price = parseFloat(data.price);
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
  const id = COINGECKO_IDS[symbol];
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

// isOtcAsset mantido para não quebrar imports — sempre retorna false (sem OTC)
export function isOtcAsset(_asset: string): boolean { return false; }

export async function getDerivPrice(asset: string): Promise<number | null> {
  const sym = BINANCE_ASSET_TO_SYMBOL[asset];
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
      const coinbasePrice = await fetchCoinbasePrice(asset);
      if (coinbasePrice) return coinbasePrice;

      // 3. CoinGecko como último fallback
      return await fetchCoinGeckoPrice(sym);
    } finally {
      // Remove assim que resolve — nunca serve um preço antigo a um pedido futuro
      _inFlight.delete(asset);
    }
  })();

  _inFlight.set(asset, fetchPromise);
  return fetchPromise;
}
