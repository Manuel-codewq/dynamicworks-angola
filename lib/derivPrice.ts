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

async function fetchBinancePrice(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
    if (!res.ok) return null;
    const data = await res.json() as { price: string };
    const price = parseFloat(data.price);
    return isFinite(price) && price > 0 ? price : null;
  } catch { return null; }
}

// isOtcAsset mantido para não quebrar imports — sempre retorna false (sem OTC)
export function isOtcAsset(_asset: string): boolean { return false; }

export async function getDerivPrice(asset: string): Promise<number | null> {
  const sym = BINANCE_ASSET_TO_SYMBOL[asset];
  if (!sym) return null;
  return fetchBinancePrice(sym);
}
