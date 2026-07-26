// Chamadas server-side às rotas de admin do synthetic-engine (ajuste de
// drift/volatility, disparo de eventos CRASH/BOOM/JUMP). Mesmo padrão de
// fetch com timeout já usado em lib/syntheticFeed.ts — a chave nunca chega
// ao browser, só é usada aqui.

const SYNTHETIC_ENGINE_URL = process.env.SYNTHETIC_ENGINE_URL ?? "http://localhost:4001";
const SYNTHETIC_ENGINE_API_KEY = process.env.SYNTHETIC_ENGINE_API_KEY;

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 6000): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" });
  } finally {
    clearTimeout(id);
  }
}

function authHeaders(): Record<string, string> {
  if (!SYNTHETIC_ENGINE_API_KEY) {
    throw new Error("SYNTHETIC_ENGINE_API_KEY não está configurada");
  }
  return { Authorization: `Bearer ${SYNTHETIC_ENGINE_API_KEY}`, "Content-Type": "application/json" };
}

export interface SyntheticIndexAdmin {
  id: string;
  symbol: string;
  displayName: string;
  type: string;
  basePrice: number;
  lastPrice: number;
  volatility: number;
  drift: number;
  decimals: number;
  eventProbability: number;
  eventMagnitude: number;
  tickIntervalMs: number;
  active: boolean;
}

export async function fetchAllIndicesAdmin(): Promise<SyntheticIndexAdmin[]> {
  const res = await fetchWithTimeout(`${SYNTHETIC_ENGINE_URL}/api/indices/admin`, {
    method: "GET",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`synthetic-engine GET /api/indices/admin: HTTP ${res.status}`);
  return await res.json() as SyntheticIndexAdmin[];
}

export async function updateSyntheticParams(
  symbol: string,
  patch: { drift?: number; volatility?: number },
): Promise<{ ok: boolean; status: number; error?: string }> {
  const res = await fetchWithTimeout(`${SYNTHETIC_ENGINE_URL}/api/indices/${symbol}/params`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(patch),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, error: data.error };
}

export async function triggerSyntheticEvent(
  symbol: string,
  type: "CRASH" | "BOOM" | "JUMP",
  magnitude: number,
): Promise<{ ok: boolean; status: number; error?: string }> {
  const res = await fetchWithTimeout(`${SYNTHETIC_ENGINE_URL}/api/indices/${symbol}/event`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ type, magnitude }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, error: data.error };
}
