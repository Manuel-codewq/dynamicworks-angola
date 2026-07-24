// Fonte única de verdade para os pares/activos negociáveis na plataforma.
// Substitui: CRYPTO_PAIRS (lib/derivWebSocket.ts), BINANCE_ASSET_TO_SYMBOL e
// COINGECKO_IDS (lib/derivPrice.ts), ALLOWED_ASSETS (app/api/trade/route.ts),
// ALL_PAIRS (lib/settings.ts) e REAL_PAIR_OPTIONS (app/ao/admin/settings/page.tsx).
//
// ATENÇÃO — chave estável: `label` é a string gravada em produção em
// Trade.asset, PriceCandle.asset, PriceAlert.asset e em Settings.payout /
// Settings.winProbability / Settings.activePairs (chaves de objecto/JSON).
// Mudar um `label` aqui sem migrar os dados existentes faz o admin perder a
// configuração de payout/winProbability desse par em silêncio, e desalinha
// o histórico de operações já gravado. Só acrescentar ou desactivar (`active:
// false`), nunca renomear um `label` existente sem migração explícita.

export type AssetCategory = "Cripto";

export interface Asset {
  /** Chave estável usada em toda a plataforma (BD, settings, UI). Ex: "BTC/USD" */
  label:         string;
  /** Símbolo do par na Binance. Ex: "BTCUSDT" */
  binanceSymbol: string;
  /** Id do activo na CoinGecko (fallback de preço). null se não houver mapeamento. */
  coingeckoId:   string | null;
  category:      AssetCategory;
  /** Casas decimais para apresentação de preço (gráfico, ticker, etc.) */
  decimals:      number;
  /** Activo por omissão na plataforma (independente do toggle "Pares activos" do admin, que actua em runtime via Settings.activePairs) */
  active:        boolean;
}

// Cada entrada confirmada individualmente contra fonte primária em 2026-07-24:
// símbolo Binance + status TRADING + tickSize via GET /api/v3/exchangeInfo;
// id CoinGecko via GET /api/v3/coins/{id}.
export const ASSETS: Asset[] = [
  // Binance: BTCUSDT, status TRADING, tickSize 0.01 → 2 casas.
  // CoinGecko: id "bitcoin" → symbol btc, name Bitcoin.
  { label: "BTC/USD", binanceSymbol: "BTCUSDT", coingeckoId: "bitcoin", category: "Cripto", decimals: 2, active: true },

  // Binance: ETHUSDT, status TRADING, tickSize 0.01 → 2 casas.
  // CoinGecko: id "ethereum" → symbol eth, name Ethereum.
  { label: "ETH/USD", binanceSymbol: "ETHUSDT", coingeckoId: "ethereum", category: "Cripto", decimals: 2, active: true },

  // Binance: BNBUSDT, status TRADING, tickSize 0.01 → 2 casas.
  // CoinGecko: id "binancecoin" → symbol bnb, name BNB.
  { label: "BNB/USD", binanceSymbol: "BNBUSDT", coingeckoId: "binancecoin", category: "Cripto", decimals: 2, active: true },

  // Binance: SOLUSDT, status TRADING, tickSize 0.01 → 2 casas.
  // CoinGecko: id "solana" → symbol sol, name Solana.
  { label: "SOL/USD", binanceSymbol: "SOLUSDT", coingeckoId: "solana", category: "Cripto", decimals: 2, active: true },

  // Binance: XRPUSDT, status TRADING, tickSize 0.0001 → 4 casas.
  // CoinGecko: id "ripple" → symbol xrp, name XRP.
  { label: "XRP/USD", binanceSymbol: "XRPUSDT", coingeckoId: "ripple", category: "Cripto", decimals: 4, active: true },

  // Binance: ADAUSDT, status TRADING, tickSize 0.0001 → 4 casas.
  // CoinGecko: id "cardano" → symbol ada, name Cardano.
  { label: "ADA/USD", binanceSymbol: "ADAUSDT", coingeckoId: "cardano", category: "Cripto", decimals: 4, active: true },

  // Binance: DOGEUSDT, status TRADING, tickSize 0.00001 → 5 casas.
  // CoinGecko: id "dogecoin" → symbol doge, name Dogecoin.
  { label: "DOGE/USD", binanceSymbol: "DOGEUSDT", coingeckoId: "dogecoin", category: "Cripto", decimals: 5, active: true },

  // Binance: LTCUSDT, status TRADING, tickSize 0.01 → 2 casas.
  // CoinGecko: id "litecoin" → symbol ltc, name Litecoin.
  { label: "LTC/USD", binanceSymbol: "LTCUSDT", coingeckoId: "litecoin", category: "Cripto", decimals: 2, active: true },
];

// ── Helpers derivados — cada um substitui uma das listas duplicadas mapeadas na Fase 1 ──

/** label → símbolo Binance. Substitui BINANCE_ASSET_TO_SYMBOL (lib/derivPrice.ts). */
export const ASSET_TO_BINANCE_SYMBOL: Record<string, string> =
  Object.fromEntries(ASSETS.map(a => [a.label, a.binanceSymbol]));

/** símbolo Binance → id CoinGecko. Substitui COINGECKO_IDS (lib/derivPrice.ts). */
export const BINANCE_SYMBOL_TO_COINGECKO_ID: Record<string, string> =
  Object.fromEntries(
    ASSETS.filter((a): a is Asset & { coingeckoId: string } => a.coingeckoId !== null)
      .map(a => [a.binanceSymbol, a.coingeckoId]),
  );

/** Set dos labels permitidos para abrir operação. Substitui ALLOWED_ASSETS (app/api/trade/route.ts). */
export const ALLOWED_ASSET_LABELS: ReadonlySet<string> = new Set(ASSETS.map(a => a.label));

/**
 * Lista de labels, na mesma ordem de ASSETS — byte-a-byte idêntica ao ALL_PAIRS
 * actual (lib/settings.ts). Substitui ALL_PAIRS / ALL_REAL_PAIR_LABELS / ALL_PAIR_KEYS.
 */
export const ASSET_LABELS: readonly string[] = ASSETS.map(a => a.label);

/** Só os activos com `active: true`. Substitui a filtragem hoje implícita em CRYPTO_PAIRS (todos activos). */
export function getActiveAssets(): Asset[] {
  return ASSETS.filter(a => a.active);
}

/**
 * Forma equivalente ao `DerivPair` existente em lib/derivWebSocket.ts
 * (symbol/label/category/decimals) — permite reconstruir CRYPTO_PAIRS /
 * getAvailablePairs() na Fase 3 sem alterar a forma consumida por
 * app/trade/page.tsx, app/bot/page.tsx e app/api/pairs/route.ts.
 *
 * TODO (shim transitório): esta forma existe só para preservar a interface
 * `DerivPair` já espalhada pelo frontend/API. Se um dia o frontend for
 * migrado para consumir `Asset`/`ASSETS` directamente, `DerivPairShape` e
 * `toDerivPairs()` deixam de ser necessários e podem ser removidos.
 */
export interface DerivPairShape {
  symbol:   string;
  label:    string;
  category: string;
  decimals: number;
}

export function toDerivPairs(assets: Asset[] = ASSETS): DerivPairShape[] {
  return assets.map(a => ({
    symbol:   a.binanceSymbol,
    label:    a.label,
    category: a.category,
    decimals: a.decimals,
  }));
}
