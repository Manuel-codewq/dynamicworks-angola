/**
 * Migra Settings.payout do formato antigo (um número por par, ex:
 * { "EUR/USD OTC": 0.85 }) para o formato novo aninhado por duração (ex:
 * { "EUR/USD OTC": { "30": 0.85, "60": 0.85, ..., "default": 0.85 } }).
 *
 * Preserva o valor actual em TODAS as durações — ninguém tem mudança de
 * payout inesperada no dia da migração, só passa a ser possível diferenciar
 * por duração dali para a frente via /ao/admin/settings.
 *
 * Pares que já estiverem no formato novo (objecto) ficam intocados —
 * idempotente, seguro correr mais que uma vez.
 *
 * Por omissão corre em DRY-RUN: mostra o antes/depois e NÃO escreve nada.
 * Só escreve mesmo com a flag --apply.
 *
 * Uso (a partir da raiz do projecto dynamics-works):
 *   npx tsx scripts/migrate-payout-durations.ts             # dry-run
 *   npx tsx scripts/migrate-payout-durations.ts --apply      # aplica mesmo
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const APPLY = process.argv.includes("--apply");
const DURATION_KEYS = ["30", "60", "120", "180", "300", "600", "900", "1800", "3600", "default"];

async function main() {
  const { prisma } = await import("../lib/prisma");

  try {
    console.log(APPLY ? "=== MODO: APLICAR (vai escrever na BD) ===" : "=== MODO: DRY-RUN (não escreve nada) ===");
    console.log();

    const row = await prisma.settings.findUnique({ where: { id: "singleton" } });
    if (!row) {
      console.error("ERRO: não existe registo Settings (id: 'singleton') na BD. Nada a migrar — aborto.");
      process.exitCode = 1;
      return;
    }

    const rawPayout = (row.payout as Record<string, unknown>) ?? {};
    const migrated: Record<string, Record<string, number>> = {};
    let convertedCount = 0, alreadyCount = 0;

    for (const [label, value] of Object.entries(rawPayout)) {
      if (typeof value === "number" && isFinite(value)) {
        migrated[label] = Object.fromEntries(DURATION_KEYS.map(k => [k, value]));
        convertedCount++;
        console.log(`${label.padEnd(16)} ${value}  ->  todas as durações = ${value}`);
      } else if (value && typeof value === "object") {
        migrated[label] = value as Record<string, number>;
        alreadyCount++;
        console.log(`${label.padEnd(16)} já no formato novo — mantido`);
      }
    }

    console.log();
    console.log(`Pares convertidos: ${convertedCount} | já migrados: ${alreadyCount} | total: ${convertedCount + alreadyCount}`);
    console.log();

    if (convertedCount === 0) {
      console.log("Nada a converter — todos os pares já estão no formato novo.");
      return;
    }

    if (APPLY) {
      await prisma.settings.update({
        where: { id: "singleton" },
        data: { payout: migrated },
      });
      console.log("Settings.payout actualizado na BD com a estrutura aninhada por duração.");
    } else {
      console.log("[dry-run] Nenhuma escrita feita na BD.");
      console.log("Corre com --apply para aplicar mesmo.");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(e => { console.error(e); process.exitCode = 1; });
