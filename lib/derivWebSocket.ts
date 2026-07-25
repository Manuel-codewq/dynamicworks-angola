import { getActiveAssets, toDerivPairs, type DerivPairShape } from "@/lib/assets";

export type DerivPair = DerivPairShape;

// Pares/activos — fonte única de verdade em lib/assets.ts
export const CRYPTO_PAIRS: DerivPair[] = toDerivPairs(getActiveAssets());

export function isRealMarketOpen(): boolean { return true; } // synthetic-engine é sempre 24/7

export function getAvailablePairs(): DerivPair[] {
  return [...CRYPTO_PAIRS];
}

export const GRANULARITY: Record<string, number> = {
  "1m": 60, "3m": 180, "5m": 300, "15m": 900,
  "30m": 1800, "1h": 3600, "4h": 14400, "1D": 86400,
};

// Timeframes que o synthetic-engine agrega (ver app/api/price-recorder/route.ts)
// — para granularidades sem candle próprio, usa-se a mais próxima disponível.
const SYNTHETIC_TIMEFRAME: Record<number, string> = {
  60: "1m", 180: "1m", 300: "5m", 900: "15m",
  1800: "15m", 3600: "15m", 14400: "15m", 86400: "15m",
};

export interface DerivTick   { symbol: string; quote: number; epoch: number; }
export interface DerivCandle { epoch: number; open: number; high: number; low: number; close: number; }

type TickHandler   = (tick: DerivTick) => void;
type CandleHandler = (symbol: string, candles: DerivCandle[]) => void;

// ── synthetic-engine, via proxy same-origin do Next.js ────────────────────
// O browser nunca liga directamente ao synthetic-engine (só acessível na
// rede interna/localhost do servidor). Ticks em tempo real chegam por SSE
// via app/api/price-stream (que por sua vez abre WebSocket ao
// synthetic-engine do lado do servidor); histórico de velas chega por REST
// via app/api/price-candles. Interface pública idêntica à antiga BinanceWS
// (WebSocket directo ao browser) — não muda nada em quem consome isto
// (app/trade/page.tsx, app/bot/page.tsx, app/api/pairs/route.ts).

class SyntheticFeed {
  private es: EventSource | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private subscribedSymbols = new Set<string>();
  private tickHandlers    = new Set<TickHandler>();
  private candleHandlers  = new Set<CandleHandler>();
  private connectHandlers = new Set<() => void>();
  private isFirstConnect  = true;

  private streamUrl(): string {
    const symbols = Array.from(this.subscribedSymbols).join(",");
    return `/api/price-stream?symbols=${encodeURIComponent(symbols)}`;
  }

  connect() {
    if (this.es) return; // já ligado (ou a ligar)
    this.open();
  }

  private open() {
    this.es?.close();
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }

    const es = new EventSource(this.streamUrl());
    this.es = es;

    es.addEventListener("connected", () => {
      if (!this.isFirstConnect) this.connectHandlers.forEach(h => h());
      this.isFirstConnect = false;
    });

    es.addEventListener("tick", (e: MessageEvent) => {
      let msg: any;
      try { msg = JSON.parse(e.data); } catch { return; }
      const quote = parseFloat(msg?.price);
      const epoch = Math.floor(Number(msg?.timestamp) / 1000);
      if (isFinite(quote) && quote > 0 && typeof msg?.symbol === "string") {
        this.tickHandlers.forEach(h => h({ symbol: msg.symbol, quote, epoch }));
      }
    });

    es.onerror = () => {
      es.close();
      if (this.es === es) this.es = null;
      this.reconnectTimer = setTimeout(() => this.open(), 3000);
    };
  }

  async loadForexCloses() {} // compatibilidade — não faz nada

  subscribeToTicks(symbols: string[]) {
    let changed = false;
    symbols.forEach(sym => {
      if (!this.subscribedSymbols.has(sym)) {
        this.subscribedSymbols.add(sym);
        changed = true;
      }
    });
    if (!changed) return;
    // EventSource não suporta enviar mensagens depois de aberto — a lista de
    // subscrições vai na própria URL de ligação, por isso alterá-la implica
    // reabrir o stream (equivalente em custo a uma reconexão normal).
    if (this.es) this.open();
  }

  async getCandles(symbol: string, granularity: number, count = 150) {
    const timeframe = SYNTHETIC_TIMEFRAME[granularity] ?? "1m";
    try {
      const url = `/api/price-candles?symbol=${symbol}&timeframe=${timeframe}&limit=${Math.min(count, 1000)}`;
      const res  = await fetch(url);
      if (!res.ok) { console.warn("[SyntheticFeed] REST erro:", res.status); return; }
      const rows = await res.json() as { open: number; high: number; low: number; close: number; timestamp: string }[];
      const candles: DerivCandle[] = rows
        .map(k => ({
          epoch: Math.floor(new Date(k.timestamp).getTime() / 1000),
          open:  k.open,
          high:  k.high,
          low:   k.low,
          close: k.close,
        }))
        .filter(c => isFinite(c.open) && isFinite(c.high) && isFinite(c.low) && isFinite(c.close) && c.high >= c.low);
      if (candles.length > 0) this.candleHandlers.forEach(h => h(symbol, candles));
    } catch (e) {
      console.warn("[SyntheticFeed] Erro ao buscar velas:", (e as Error).message);
    }
  }

  unsubscribeAll() {
    this.subscribedSymbols.clear();
    this.es?.close();
    this.es = null;
  }

  onTick(handler: TickHandler):      () => void { this.tickHandlers.add(handler);    return () => this.tickHandlers.delete(handler); }
  onCandles(handler: CandleHandler): () => void { this.candleHandlers.add(handler);  return () => this.candleHandlers.delete(handler); }
  onConnect(handler: () => void):    () => void { this.connectHandlers.add(handler); return () => this.connectHandlers.delete(handler); }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.es?.close(); this.es = null;
    this.subscribedSymbols.clear();
  }
}

export const derivWS = new SyntheticFeed();
