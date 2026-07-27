/**
 * Define User.twoFactorDeadline = now + 7 dias para todas as contas que
 * ainda não têm 2FA activo e ainda não têm um prazo definido. Faz parte do
 * lançamento do 2FA obrigatório: dá 7 dias de graça, a contar de agora, a
 * todas as contas existentes com a mesma data-limite fixa.
 *
 * Idempotente: só toca em twoFactorDeadline: null, por isso corridas
 * repetidas não empurram o prazo para a frente. Não mexe em quem já tem
 * twoFactorEnabled: true.
 *
 * Por omissão corre em DRY-RUN: mostra quantas contas seriam afectadas e
 * NÃO escreve nada. Só escreve mesmo com a flag --apply.
 *
 * Uso (a partir da raiz do projecto dynamics-works):
 *   npx tsx scripts/set-2fa-deadline.ts             # dry-run (seguro, não altera nada)
 *   npx tsx scripts/set-2fa-deadline.ts --apply      # aplica mesmo — escreve na BD
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" }); // .env.local tem prioridade (mesma ordem que o Next.js usa)
loadEnv({ path: ".env" });

const APPLY = process.argv.includes("--apply");
const GRACE_DAYS = 7;

async function main() {
  // import() dinâmico DE PROPÓSITO: ver reset-active-pairs.ts para a razão
  // (lib/prisma.ts lê DATABASE_URL na avaliação do módulo, antes do loadEnv acima
  // correr, se o import fosse estático).
  const { prisma } = await import("../lib/prisma");

  try {
    console.log(APPLY ? "=== MODO: APLICAR (vai escrever na BD) ===" : "=== MODO: DRY-RUN (não escreve nada) ===");
    console.log();

    const affected = await prisma.user.findMany({
      where: { twoFactorEnabled: false, twoFactorDeadline: null },
      select: { id: true, email: true },
    });

    console.log(`Contas sem 2FA e sem prazo definido: ${affected.length}`);
    if (affected.length > 0) {
      console.log("Amostra (até 10):", affected.slice(0, 10).map(u => u.email));
    }
    console.log();

    if (affected.length === 0) {
      console.log("Nada a fazer — todas as contas elegíveis já têm twoFactorDeadline definido.");
      return;
    }

    const deadline = new Date(Date.now() + GRACE_DAYS * 24 * 3600 * 1000);
    console.log(`Prazo a atribuir a todas: ${deadline.toISOString()}`);
    console.log();

    if (APPLY) {
      const result = await prisma.user.updateMany({
        where: { twoFactorEnabled: false, twoFactorDeadline: null },
        data: { twoFactorDeadline: deadline },
      });
      console.log(`Actualizado: ${result.count} conta(s) com twoFactorDeadline = ${deadline.toISOString()}.`);
    } else {
      console.log("[dry-run] Nenhuma escrita feita na BD.");
      console.log("Corre com --apply para aplicar mesmo.");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(e => { console.error(e); process.exitCode = 1; });
