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

export type AssetCategory = "Cripto" | "Forex" | "Matérias-primas" | "Acções";

// Bandeiras SVG (public/flags/, extraídas do pacote flag-icons — MIT) para os
// dois lados de cada par (ex: EUR/USD → bandeira UE + bandeira EUA). Emoji de
// bandeira Unicode foi tentado antes e falhou em Windows/Chrome (renderizava
// as letras indicadoras regionais em bruto, ex: "EUS") — por isso SVG.
export const CURRENCY_FLAGS: Record<string, string> = {
  EUR: "/flags/eu.svg",
  USD: "/flags/us.svg",
  GBP: "/flags/gb.svg",
  JPY: "/flags/jp.svg",
  AUD: "/flags/au.svg",
  CAD: "/flags/ca.svg",
  CHF: "/flags/ch.svg",
  NZD: "/flags/nz.svg",
};

// Ícones de cripto (public/crypto/, extraídos do pacote cryptocurrency-icons
// — CC0) — mesmo padrão do CURRENCY_FLAGS, usados como o lado "base" do par
// (ex: BTC/USD → ícone BTC + bandeira US).
export const CRYPTO_ICONS: Record<string, string> = {
  BTC: "/crypto/btc.svg",
  ETH: "/crypto/eth.svg",
  SOL: "/crypto/sol.svg",
  XRP: "/crypto/xrp.svg",
};

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
  { label: "USD/CAD OTC", syntheticSymbol: "USDCAD_OTC", category: "Forex", decimals: 5, active: true },
  { label: "EUR/GBP OTC", syntheticSymbol: "EURGBP_OTC", category: "Forex", decimals: 5, active: true },
  { label: "EUR/JPY OTC", syntheticSymbol: "EURJPY_OTC", category: "Forex", decimals: 3, active: true },
  { label: "GBP/JPY OTC", syntheticSymbol: "GBPJPY_OTC", category: "Forex", decimals: 3, active: true },
  { label: "USD/CHF OTC", syntheticSymbol: "USDCHF_OTC", category: "Forex", decimals: 5, active: true },
  { label: "NZD/USD OTC", syntheticSymbol: "NZDUSD_OTC", category: "Forex", decimals: 5, active: true },
  { label: "EUR/CHF OTC", syntheticSymbol: "EURCHF_OTC", category: "Forex", decimals: 5, active: true },
  { label: "AUD/JPY OTC", syntheticSymbol: "AUDJPY_OTC", category: "Forex", decimals: 3, active: true },

  // Novos instrumentos (2026-07-30) — Cripto, Matérias-primas, Acções.
  // syntheticSymbol tem de bater certo com prisma/seed.ts do synthetic-engine
  // (repo separado, sincronizado manualmente — ver comentário no topo do ficheiro).
  { label: "XAU/USD OTC", syntheticSymbol: "XAUUSD_OTC", category: "Matérias-primas", decimals: 2, active: true },
  { label: "XAG/USD OTC", syntheticSymbol: "XAGUSD_OTC", category: "Matérias-primas", decimals: 3, active: true },
  { label: "WTI/USD OTC", syntheticSymbol: "WTIUSD_OTC", category: "Matérias-primas", decimals: 2, active: true },

  { label: "AAPL OTC",  syntheticSymbol: "AAPL_OTC",  category: "Acções", decimals: 2, active: true },
  { label: "MSFT OTC",  syntheticSymbol: "MSFT_OTC",  category: "Acções", decimals: 2, active: true },
  { label: "GOOGL OTC", syntheticSymbol: "GOOGL_OTC", category: "Acções", decimals: 2, active: true },
  { label: "AMZN OTC",  syntheticSymbol: "AMZN_OTC",  category: "Acções", decimals: 2, active: true },
  { label: "TSLA OTC",  syntheticSymbol: "TSLA_OTC",  category: "Acções", decimals: 2, active: true },

  { label: "BTC/USD OTC", syntheticSymbol: "BTCUSD_OTC", category: "Cripto", decimals: 2, active: true },
  { label: "ETH/USD OTC", syntheticSymbol: "ETHUSD_OTC", category: "Cripto", decimals: 2, active: true },
  { label: "SOL/USD OTC", syntheticSymbol: "SOLUSD_OTC", category: "Cripto", decimals: 3, active: true },
  { label: "XRP/USD OTC", syntheticSymbol: "XRPUSD_OTC", category: "Cripto", decimals: 4, active: true },
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
 * Roda ciclicamente os pares dentro de cada categoria, com deslocamento
 * derivado do dia.
 *
 * Sem isto era sempre o EUR/USD no topo da lista e sempre ele a abrir por
 * omissão no /trade — todo o volume concentrava-se num par só. Com a rotação,
 * cada dia é outro par a liderar cada categoria.
 *
 * É rotação e não baralhamento de propósito: a ordem relativa mantém-se, por
 * isso quem procura um par continua a encontrá-lo junto dos mesmos vizinhos.
 * E o deslocamento é por dia (não por pedido) para a lista não saltar debaixo
 * dos olhos de quem está a operar — só muda de um dia para o outro.
 */
export function rotatePairsByDay<T extends { category: string }>(
  list: T[],
  now: Date = new Date(),
): T[] {
  const dayIndex = Math.floor(now.getTime() / 86_400_000);
  const out = [...list];

  // Índices ocupados por cada categoria — a rotação acontece dentro deles,
  // por isso os blocos de categoria ficam onde estavam.
  const slots = new Map<string, number[]>();
  list.forEach((item, i) => {
    const arr = slots.get(item.category);
    if (arr) arr.push(i);
    else slots.set(item.category, [i]);
  });

  for (const idxs of slots.values()) {
    if (idxs.length < 2) continue;
    const shift = dayIndex % idxs.length;
    idxs.forEach((pos, k) => { out[pos] = list[idxs[(k + shift) % idxs.length]]; });
  }
  return out;
}

// ── Payout por par × duração (2026-07-30) ───────────────────────────────────
//
// Durações (segundos) com payout configurável por par — mesmos presets do
// selector de tempo no /trade (EXPIRY_OPTIONS em app/trade/page.tsx,
// mantido em sincronia manualmente por serem módulos diferentes). "default"
// cobre qualquer duração fora desta lista — personalizado (1-59min) ou
// comutação (fecha com a vela, duração dinâmica).
export const PAYOUT_DURATIONS = [30, 60, 120, 180, 300, 600, 900, 1800, 3600] as const;
export const PAYOUT_DURATION_KEYS: readonly string[] = [...PAYOUT_DURATIONS.map(String), "default"];

/**
 * Payout de um par para uma duração específica, com fallback para "default"
 * e depois para 0.85 se o par nem sequer tiver entrada. Pura (sem I/O) —
 * usada tanto no servidor (app/api/trade/route.ts) como no cliente
 * (app/trade/page.tsx), por isso não pode importar nada de `lib/prisma`.
 */
export function resolvePayout(
  payoutMap: Record<string, Record<string, number>> | undefined | null,
  label: string,
  expirySecs: number,
): number {
  const entry = payoutMap?.[label];
  if (!entry) return 0.85;
  return entry[String(expirySecs)] ?? entry.default ?? 0.85;
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
