/**
 * Repõe Settings.activePairs, Settings.payout e Settings.winProbability a
 * partir de lib/assets.ts (ASSETS) — a fonte única de verdade dos pares
 * negociáveis. Útil para corrigir Settings.activePairs se algum dia divergir
 * da lista real de activos suportados pela plataforma.
 *
 * Por omissão corre em DRY-RUN: lê o estado actual, mostra o que mudaria,
 * e NÃO escreve nada (nem na BD, nem o ficheiro de backup). Só escreve
 * mesmo com a flag --apply.
 *
 * Uso (a partir da raiz do projecto dynamics-works):
 *   npx tsx scripts/reset-active-pairs.ts             # dry-run (seguro, não altera nada)
 *   npx tsx scripts/reset-active-pairs.ts --apply      # aplica mesmo — grava backup + escreve na BD
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" }); // .env.local tem prioridade (mesma ordem que o Next.js usa)
loadEnv({ path: ".env" });

import { writeFileSync } from "fs";
import { resolve } from "path";

const APPLY = process.argv.includes("--apply");

function nowStamp(): string {
  // Seguro para nome de ficheiro (sem ":" nem ".") — ex: 2026-07-24T21-40-05-123Z
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function main() {
  // import() dinâmico DE PROPÓSITO: imports estáticos são içados antes de
  // qualquer código correr (incluindo o loadEnv() acima), e lib/prisma.ts lê
  // process.env.DATABASE_URL no momento em que o módulo é avaliado — um
  // import estático faria o cliente Prisma ser criado sem a variável ainda
  // definida.
  const { prisma } = await import("../lib/prisma");
  const { getActiveAssets } = await import("../lib/assets");
  const { DEFAULT_PAYOUT, DEFAULT_WIN_PROBABILITY } = await import("../lib/settings");

  try {
    console.log(APPLY ? "=== MODO: APLICAR (vai gravar backup + escrever na BD) ===" : "=== MODO: DRY-RUN (não escreve nada) ===");
    console.log();

    // ── 1. Ler estado actual e preparar backup ────────────────────────────
    const before = await prisma.settings.findUnique({ where: { id: "singleton" } });
    if (!before) {
      console.error("ERRO: não existe registo Settings (id: 'singleton') na BD. Nada a repor — aborto.");
      process.exitCode = 1;
      return;
    }

    const backup = {
      capturedAt:     new Date().toISOString(),
      mode:           APPLY ? "apply" : "dry-run",
      settingsId:     before.id,
      activePairs:    before.activePairs,
      payout:         before.payout,
      winProbability: before.winProbability,
    };

    console.log("── Settings ACTUAL, lido da BD (antes de qualquer alteração) ──");
    console.log(JSON.stringify(backup, null, 2));
    console.log();

    const backupFilename = `backup-activePairs-${nowStamp()}.json`;
    const backupPath = resolve(process.cwd(), backupFilename);

    if (APPLY) {
      writeFileSync(backupPath, JSON.stringify(backup, null, 2), "utf-8");
      console.log(`Backup gravado em: ${backupPath}`);
    } else {
      console.log(`[dry-run] Backup SERIA gravado em: ${backupPath} (não foi criado)`);
    }
    console.log();

    // ── 2. Calcular o novo estado a partir de lib/assets.ts ───────────────
    const newActivePairs = getActiveAssets().map((a: { label: string }) => a.label);

    const proposed = {
      activePairs:    newActivePairs,
      payout:         DEFAULT_PAYOUT,
      winProbability: DEFAULT_WIN_PROBABILITY,
    };

    console.log("── Novo estado PROPOSTO, calculado a partir de ASSETS (lib/assets.ts) ──");
    console.log(JSON.stringify(proposed, null, 2));
    console.log();

    if (APPLY) {
      await prisma.settings.update({
        where: { id: "singleton" },
        data: {
          activePairs:    newActivePairs,
          payout:         DEFAULT_PAYOUT,
          winProbability: DEFAULT_WIN_PROBABILITY,
        },
      });
      console.log("Settings actualizado na BD (activePairs, payout, winProbability).");
    } else {
      console.log("[dry-run] Nenhuma escrita feita na BD.");
    }
    console.log();

    // ── 3. Reler da BD e imprimir o resultado final, para comparação ──────
    const after = await prisma.settings.findUnique({ where: { id: "singleton" } });

    console.log("── Settings DEPOIS, relido directamente da BD ──");
    console.log(JSON.stringify({
      activePairs:    after?.activePairs,
      payout:         after?.payout,
      winProbability: after?.winProbability,
    }, null, 2));

    if (!APPLY) {
      console.log();
      console.log("Isto foi um DRY-RUN — o estado \"depois\" acima é igual ao \"antes\" porque nada foi escrito.");
      console.log("Corre com --apply para aplicar mesmo (grava o backup e actualiza a BD).");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(e => { console.error(e); process.exitCode = 1; });
