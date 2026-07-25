/**
 * Verifica que ASSET_LABELS (lib/assets.ts) corresponde exactamente ao
 * baseline congelado abaixo. Essas chaves estão gravadas em produção em
 * Settings.payout / Settings.winProbability / Settings.activePairs (chaves
 * de objecto/JSON) — qualquer diferença faz o admin perder configuração de
 * payout/winProbability em silêncio.
 *
 * A referência abaixo está CONGELADA de propósito (copiada à mão, não
 * derivada de lib/assets.ts nem de lib/settings.ts) para servir de
 * testemunha independente do valor esperado.
 *
 * IMPORTANTE — este baseline tem de ser actualizado À MÃO sempre que um par
 * for acrescentado ou removido em lib/assets.ts (ASSETS). Não é automático
 * de propósito: o objectivo é que uma mudança na lista de pares só passe
 * neste script depois de alguém confirmar explicitamente "sim, é isto que
 * eu queria" — nunca deixar isto passar em silêncio sem revisão.
 *
 * Corre com: npx tsx scripts/verify-asset-keys.ts
 */
import { ASSET_LABELS } from "../lib/assets";

// Baseline actualizado à mão em 2026-07-25, depois de expandir de 8 para 16
// pares (commit f6207a9) — reflecte lib/assets.ts:ASSETS nesse momento.
const FROZEN_ALL_PAIRS = [
  "BTC/USD", "ETH/USD", "BNB/USD", "SOL/USD",
  "XRP/USD", "ADA/USD", "DOGE/USD", "LTC/USD",
  "AVAX/USD", "LINK/USD", "DOT/USD", "TRX/USD",
  "BCH/USD", "ATOM/USD", "NEAR/USD", "XLM/USD",
] as const;

const oldSet = new Set<string>(FROZEN_ALL_PAIRS);
const newSet = new Set<string>(ASSET_LABELS);

const missing = FROZEN_ALL_PAIRS.filter(k => !newSet.has(k)); // estava, deixou de estar
const extra   = ASSET_LABELS.filter(k => !oldSet.has(k));     // não estava, apareceu

const sameLength = FROZEN_ALL_PAIRS.length === ASSET_LABELS.length;
const sameOrder  = sameLength && FROZEN_ALL_PAIRS.every((k, i) => k === ASSET_LABELS[i]);
const hasDupes   = oldSet.size !== FROZEN_ALL_PAIRS.length || newSet.size !== ASSET_LABELS.length;

console.log("── Chaves antigas (baseline congelado, actualizado em 2026-07-25) ──");
FROZEN_ALL_PAIRS.forEach((k, i) => console.log(`  [${i}] ${JSON.stringify(k)}`));

console.log("\n── Chaves novas (ASSET_LABELS, lib/assets.ts) ──");
ASSET_LABELS.forEach((k, i) => console.log(`  [${i}] ${JSON.stringify(k)}`));

console.log("\n── Comparação lado a lado ──");
const maxLen = Math.max(FROZEN_ALL_PAIRS.length, ASSET_LABELS.length);
for (let i = 0; i < maxLen; i++) {
  const a = FROZEN_ALL_PAIRS[i] ?? "—";
  const b = ASSET_LABELS[i] ?? "—";
  const mark = a === b ? "=" : "≠";
  console.log(`  [${i}] ${a.padEnd(10)} ${mark} ${b}`);
}

let ok = true;

if (missing.length > 0) {
  ok = false;
  console.error(`\nERRO: ${missing.length} chave(s) em falta em ASSET_LABELS: ${missing.map(k => JSON.stringify(k)).join(", ")}`);
}
if (extra.length > 0) {
  ok = false;
  console.error(`\nERRO: ${extra.length} chave(s) a mais em ASSET_LABELS: ${extra.map(k => JSON.stringify(k)).join(", ")}`);
}
if (missing.length === 0 && extra.length === 0 && hasDupes) {
  ok = false;
  console.error(`\nERRO: há chaves duplicadas dentro de um dos conjuntos (tamanho do Set difere do array).`);
}

if (ok && !sameOrder) {
  console.warn(`\nAVISO (não fatal): a ordem das chaves mudou entre ALL_PAIRS e ASSET_LABELS.`);
}

if (ok) {
  console.log(`\nOK — ${newSet.size} chaves, conjunto idêntico ao ALL_PAIRS congelado.${sameOrder ? " Ordem também preservada." : ""}`);
  process.exit(0);
} else {
  console.error(`\nFALHOU — ver erros acima.`);
  process.exit(1);
}
