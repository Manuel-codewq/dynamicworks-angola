// Fonte única de verdade para os pares/activos negociáveis na plataforma.
// Substitui: CRYPTO_PAIRS (lib/derivWebSocket.ts), ALLOWED_ASSETS
// (app/api/trade/route.ts), ALL_PAIRS (lib/settings.ts) e REAL_PAIR_OPTIONS
// (app/ao/admin/settings/page.tsx).
//
// Fonte do preço: synthetic-engine (serviço interno, ver synthetic-engine/)
// — substitui a Binance/Coinbase/CoinGecko usadas até 2026-07-25.
//
// ATENÇÃO — chave estável: `label` é a string gravada em produção em
// Trade.asset, PriceCandle.asset, PriceAlert.asset e em Settings.payout /
// Settings.winProbability / Settings.activePairs (chaves de objecto/JSON).
// Mudar um `label` aqui sem migrar os dados existentes faz o admin perder a
// configuração de payout/winProbability desse par em silêncio, e desalinha
// o histórico de operações já gravado. Só acrescentar ou desactivar (`active:
// false`), nunca renomear um `label` existente sem migração explícita.

export type AssetCategory = "Cripto" | "Forex";

export interface Asset {
  /** Chave estável usada em toda a plataforma (BD, settings, UI). Ex: "EUR/USD OTC" */
  label:           string;
  /** Símbolo do par no synthetic-engine. Ex: "EURUSD_OTC" */
  syntheticSymbol: string;
  category:        AssetCategory;
  /** Casas decimais para apresentação de preço (gráfico, ticker, etc.) */
  decimals:        number;
  /** Activo por omissão na plataforma (independente do toggle "Pares activos" do admin, que actua em runtime via Settings.activePairs) */
  active:          boolean;
}

// Valores (symbol/displayName/decimals) idênticos aos gravados em
// synthetic-engine/prisma/seed.ts — mantidos em sincronia manualmente, já
// que são dois processos/bases de dados separados.
export const ASSETS: Asset[] = [
  { label: "EUR/USD OTC", syntheticSymbol: "EURUSD_OTC", category: "Forex", decimals: 5, active: true },
  { label: "GBP/USD OTC", syntheticSymbol: "GBPUSD_OTC", category: "Forex", decimals: 5, active: true },
  { label: "USD/JPY OTC", syntheticSymbol: "USDJPY_OTC", category: "Forex", decimals: 3, active: true },
  { label: "AUD/USD OTC", syntheticSymbol: "AUDUSD_OTC", category: "Forex", decimals: 5, active: true },
];

// ── Helpers derivados — cada um substitui uma das listas duplicadas mapeadas na Fase 1 ──

/** label → símbolo synthetic-engine. Substitui ASSET_TO_BINANCE_SYMBOL. */
export const ASSET_TO_SYNTHETIC_SYMBOL: Record<string, string> =
  Object.fromEntries(ASSETS.map(a => [a.label, a.syntheticSymbol]));

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
 * getAvailablePairs() sem alterar a forma consumida por app/trade/page.tsx,
 * app/bot/page.tsx e app/api/pairs/route.ts.
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
    symbol:   a.syntheticSymbol,
    label:    a.label,
    category: a.category,
    decimals: a.decimals,
  }));
}
