import { prisma } from "./prisma";

// Operações que devem falhar FECHADO quando a BD está indisponível.
// Para estas, um erro de DB resulta em "bloqueado" para proteger o sistema.
const FAIL_CLOSED_STORES = new Set(["login_ip", "login_email", "register", "otp"]);

/**
 * Incrementa um contador de falhas e retorna o total actual.
 * Usado para lockout progressivo (só conta falhas, não tentativas totais).
 */
export async function incrementFailCount(key: string, windowMs: number): Promise<number> {
  const id = `fail:${key}`;
  try {
    const now = new Date();
    return await prisma.$transaction(async (tx) => {
      const entry = await tx.rateLimit.findUnique({ where: { key: id } });
      if (!entry || entry.resetAt < now) {
        await tx.rateLimit.upsert({
          where:  { key: id },
          create: { key: id, count: 1, resetAt: new Date(Date.now() + windowMs) },
          update: { count: 1, resetAt: new Date(Date.now() + windowMs) },
        });
        return 1;
      }
      const updated = await tx.rateLimit.update({
        where: { key: id },
        data:  { count: { increment: 1 } },
      });
      return updated.count;
    });
  } catch { return 0; }
}

/** Retorna o número de falhas actuais para uma chave. */
export async function getFailCount(key: string): Promise<number> {
  const id = `fail:${key}`;
  try {
    const entry = await prisma.rateLimit.findUnique({ where: { key: id } });
    if (!entry || entry.resetAt < new Date()) return 0;
    return entry.count;
  } catch { return 0; }
}

/** Limpa o contador de falhas após login bem-sucedido. */
export async function resetFailCount(key: string): Promise<void> {
  const id = `fail:${key}`;
  try { await prisma.rateLimit.deleteMany({ where: { key: id } }); } catch { /* non-critical */ }
}

/**
 * Rate limiting persistente via DB — funciona em ambientes serverless/multi-instância.
 *
 * @param name     Nome do store (ex: "otp", "trade") — isolado por rota
 * @param key      Identificador único do actor (userId, email, IP…)
 * @param max      Número máximo de tentativas na janela
 * @param windowMs Duração da janela em milissegundos
 * @returns true se permitido, false se bloqueado
 */
export async function checkRateLimit(
  name: string,
  key: string,
  max: number,
  windowMs: number,
): Promise<boolean> {
  const id  = `${name}:${key}`;
  const now = new Date();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const entry = await tx.rateLimit.findUnique({ where: { key: id } });

      if (!entry || entry.resetAt < now) {
        await tx.rateLimit.upsert({
          where:  { key: id },
          create: { key: id, count: 1, resetAt: new Date(Date.now() + windowMs) },
          update: { count: 1, resetAt: new Date(Date.now() + windowMs) },
        });
        return true;
      }

      if (entry.count >= max) return false;

      await tx.rateLimit.update({
        where: { key: id },
        data:  { count: { increment: 1 } },
      });
      return true;
    });

    return result;
  } catch {
    // Operações sensíveis falham fechado (bloqueadas) em caso de erro de BD.
    // Operações menos críticas (ex: trade) falham abertas para não prejudicar utilizadores legítimos.
    return !FAIL_CLOSED_STORES.has(name);
  }
}
