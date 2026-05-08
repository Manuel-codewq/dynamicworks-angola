type RateLimitEntry = { count: number; resetAt: number };

const stores = new Map<string, Map<string, RateLimitEntry>>();

function getStore(name: string): Map<string, RateLimitEntry> {
  if (!stores.has(name)) stores.set(name, new Map());
  return stores.get(name)!;
}

/**
 * Verifica rate limit para uma chave (userId, email, IP, etc).
 * @param name    Nome do store (ex: "otp", "verify-email") — isolado por rota
 * @param key     Identificador único do actor (userId, email, IP…)
 * @param max     Número máximo de tentativas na janela
 * @param windowMs Duração da janela em milissegundos
 * @returns true se permitido, false se bloqueado
 */
export function checkRateLimit(name: string, key: string, max: number, windowMs: number): boolean {
  const store = getStore(name);
  const now   = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count++;
  return true;
}
