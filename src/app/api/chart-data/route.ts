/**
 * /api/chart-data
 * Backend route que pre-fetches historical chart data from Deriv API server-side via WebSocket.
 * Results are cached in-memory (TTL: 60s) so subsequent users get instant data.
 *
 * GET /api/chart-data?sym=R_10&style=ticks&gran=60
 */

import { NextRequest, NextResponse } from 'next/server';

// ── In-memory cache ──────────────────────────────────────────────────────────
interface CacheEntry { data: unknown; cachedAt: number; }
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000;
const MAX_CACHE = 50;

// ── Rate limiter (20 req / 60s por IP) ───────────────────────────────────────
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT    = 20;   // max requests
const RATE_WINDOW   = 60_000; // janela de 60 segundos

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_WINDOW) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count++;
  if (entry.count > RATE_LIMIT) return true;
  return false;
}

function cacheKey(sym: string, style: string, gran: number) { return `${sym}:${style}:${gran}`; }

function fromCache(key: string): CacheEntry | null {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() - e.cachedAt > CACHE_TTL_MS) { cache.delete(key); return null; }
  return e;
}

function toCache(key: string, data: unknown) {
  if (cache.size >= MAX_CACHE) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].cachedAt - b[1].cachedAt)[0];
    if (oldest) cache.delete(oldest[0]);
  }
  cache.set(key, { data, cachedAt: Date.now() });
}

// ── Deriv WebSocket fetch (server-side, Node 18+ native WebSocket) ───────────
const APP_ID = 127916;
const WS_URL  = `wss://ws.binaryws.com/websockets/v3?app_id=${APP_ID}&l=PT`;
const TIMEOUT = 12_000;

function fetchDerivHistory(sym: string, style: 'ticks' | 'candles', gran: number): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) { settled = true; try { ws.close(); } catch { /* ignore */ } reject(new Error('Timeout')); }
    }, TIMEOUT);

    // Node 18+ has native WebSocket but it might not be in the global scope in all runtimes
    // Use the globally available WebSocket if possible, otherwise polyfill
    const WS = (globalThis as any).WebSocket ?? (() => { throw new Error('WebSocket not available in this runtime'); })();
    const ws: WebSocket = new WS(WS_URL);

    ws.onopen = () => {
      const payload: Record<string, unknown> = {
        ticks_history: sym,
        adjust_start_time: 1,
        count: 1000,
        end: 'latest',
        start: 1,
        style,
      };
      if (style === 'candles') payload.granularity = gran;
      ws.send(JSON.stringify(payload));
    };

    ws.onmessage = (evt: MessageEvent) => {
      if (settled) return;
      try {
        const data = JSON.parse(typeof evt.data === 'string' ? evt.data : '') as Record<string, unknown>;
        if (data.msg_type === 'history' && data.history) {
          settled = true; clearTimeout(timer); ws.close(); resolve(data.history);
        } else if (data.msg_type === 'candles' && data.candles) {
          settled = true; clearTimeout(timer); ws.close(); resolve({ candles: data.candles });
        } else if (data.msg_type === 'error') {
          const msg = (data.error as any)?.message ?? 'Deriv API error';
          settled = true; clearTimeout(timer); ws.close();
          // Mercado fechado ou símbolo inválido — retornar dados vazios em vez de erro
          // para que o gráfico mostre "sem dados" em vez de quebrar
          resolve({ times: [], prices: [], _closed: true, _reason: msg });
        }
      } catch {
        if (!settled) { settled = true; clearTimeout(timer); ws.close(); reject(new Error('Parse error')); }
      }
    };

    ws.onerror = () => {
      if (!settled) { settled = true; clearTimeout(timer); reject(new Error('WebSocket error')); }
    };
  });
}

// ── Route Handler ────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  // Rate limiting
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? 'unknown';

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'Rate limit excedido. Tente novamente em 60 segundos.' },
      { status: 429, headers: { 'Retry-After': '60', 'X-RateLimit-Limit': String(RATE_LIMIT) } }
    );
  }

  const { searchParams } = req.nextUrl;
  const sym   = searchParams.get('sym')   ?? 'R_10';
  const style = (searchParams.get('style') ?? 'ticks') as 'ticks' | 'candles';
  const gran  = parseInt(searchParams.get('gran') ?? '60', 10);

  const key    = cacheKey(sym, style, gran);
  const cached = fromCache(key);

  if (cached) {
    return NextResponse.json({ cached: true, cachedAt: cached.cachedAt, sym, style, gran, data: cached.data },
      { headers: { 'Cache-Control': 'public, max-age=30', 'X-Cache': 'HIT' } });
  }

  try {
    const data = await fetchDerivHistory(sym, style, gran);
    toCache(key, data);
    return NextResponse.json({ cached: false, cachedAt: Date.now(), sym, style, gran, data },
      { headers: { 'Cache-Control': 'public, max-age=30', 'X-Cache': 'MISS' } });
  } catch (err) {
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 502 },
    );
  }
}
