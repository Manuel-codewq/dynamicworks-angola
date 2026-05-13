import { prisma } from "./prisma";

// Operações que devem falhar FECHADO quando a BD está indisponível.
// Para estas, um erro de DB resulta em "bloqueado" para proteger o sistema.
const FAIL_CLOSED_STORES = new Set(["login_ip", "login_email", "register", "otp"]);

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
