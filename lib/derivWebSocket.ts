const BINANCE_WS_URL = "wss://stream.binance.com:9443/ws";
const BINANCE_REST   = "https://api.binance.com/api/v3";

const BINANCE_INTERVAL: Record<number, string> = {
  60: "1m", 180: "3m", 300: "5m", 900: "15m",
  1800: "30m", 3600: "1h", 14400: "4h", 86400: "1d",
};

export interface DerivPair {
  symbol:   string;
  label:    string;
  category: string;
  decimals: number;
}

// Todos os pares são agora Binance — preços reais, 24/7
export const CRYPTO_PAIRS: DerivPair[] = [
  { symbol: "BTCUSDT",  label: "BTC/USD",  category: "Cripto", decimals: 2 },
  { symbol: "ETHUSDT",  label: "ETH/USD",  category: "Cripto", decimals: 2 },
  { symbol: "BNBUSDT",  label: "BNB/USD",  category: "Cripto", decimals: 2 },
  { symbol: "SOLUSDT",  label: "SOL/USD",  category: "Cripto", decimals: 2 },
  { symbol: "XRPUSDT",  label: "XRP/USD",  category: "Cripto", decimals: 4 },
  { symbol: "ADAUSDT",  label: "ADA/USD",  category: "Cripto", decimals: 4 },
  { symbol: "DOGEUSDT", label: "DOGE/USD", category: "Cripto", decimals: 5 },
  { symbol: "LTCUSDT",  label: "LTC/USD",  category: "Cripto", decimals: 2 },
];

// Mantidos vazios para compatibilidade com imports existentes
export const FOREX_PAIRS:      DerivPair[] = [];
export const COMMODITY_PAIRS:  DerivPair[] = [];
export const SYNTHETIC_PAIRS:  DerivPair[] = [];
export const SYNTHETIC_LABEL_TO_SYMBOL: Record<string, string> = {};

export function isRealMarketOpen(): boolean { return true; } // Binance é sempre 24/7

export function getAvailablePairs(): DerivPair[] {
  return [...CRYPTO_PAIRS];
}

export const GRANULARITY: Record<string, number> = {
  "1m": 60, "3m": 180, "5m": 300, "15m": 900,
  "30m": 1800, "1h": 3600, "4h": 14400, "1D": 86400,
};

export interface DerivTick   { symbol: string; quote: number; epoch: number; }
export interface DerivCandle { epoch: number; open: number; high: number; low: number; close: number; }

type TickHandler   = (tick: DerivTick) => void;
type CandleHandler = (symbol: string, candles: DerivCandle[]) => void;

// ── Binance WebSocket (todos os pares, preços reais 24/7) ────────────────────

class BinanceWS {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private subscribedStreams = new Set<string>();
  private tickHandlers    = new Set<TickHandler>();
  private candleHandlers  = new Set<CandleHandler>();
  private connectHandlers = new Set<() => void>();
  private isFirstConnect  = true;

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    this.ws = new WebSocket(BINANCE_WS_URL);

    this.ws.onopen = () => {
      if (this.subscribedStreams.size > 0) {
        this.ws!.send(JSON.stringify({
          method: "SUBSCRIBE",
          params: Array.from(this.subscribedStreams),
          id: 1,
        }));
      }
      if (!this.isFirstConnect) this.connectHandlers.forEach(h => h());
      this.isFirstConnect = false;
    };

    this.ws.onmessage = (e) => {
      let data: any;
      try { data = JSON.parse(e.data); } catch { return; }
      // Ignorar acks de controlo (subscribe/unsubscribe)
      if (!data || data.result !== undefined || !data.e) return;

      if (data.e === "trade") {
        const quote = parseFloat(data.p);
        const epoch = Math.floor(Number(data.T) / 1000);
        if (isFinite(quote) && quote > 0) {
          this.tickHandlers.forEach(h => h({ symbol: data.s as string, quote, epoch }));
        }
      }
    };

    this.ws.onclose  = () => { this.ws = null; this.reconnectTimer = setTimeout(() => this.connect(), 3000); };
    this.ws.onerror  = () => { this.ws?.close(); };
  }

  async loadForexCloses() {} // compatibilidade — não faz nada

  subscribeToTicks(symbols: string[]) {
    const newStreams: string[] = [];
    symbols.forEach(sym => {
      const stream = `${sym.toLowerCase()}@trade`;
      if (!this.subscribedStreams.has(stream)) {
        this.subscribedStreams.add(stream);
        newStreams.push(stream);
        console.log("[BinanceWS] Subscrito:", sym);
      }
    });
    if (newStreams.length === 0) return;
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ method: "SUBSCRIBE", params: newStreams, id: Date.now() }));
    } else {
      this.connect();
    }
  }

  async getCandles(symbol: string, granularity: number, count = 150) {
    const interval = BINANCE_INTERVAL[granularity] ?? "1m";
    try {
      const url = `${BINANCE_REST}/klines?symbol=${symbol}&interval=${interval}&limit=${Math.min(count, 1000)}`;
      const res  = await fetch(url);
      if (!res.ok) { console.warn("[BinanceWS] REST erro:", res.status); return; }
      const rows: any[][] = await res.json();
      const candles: DerivCandle[] = rows
        .map(k => ({
          epoch: Math.floor(Number(k[0]) / 1000),
          open:  parseFloat(k[1]),
          high:  parseFloat(k[2]),
          low:   parseFloat(k[3]),
          close: parseFloat(k[4]),
        }))
        .filter(c => isFinite(c.open) && isFinite(c.high) && isFinite(c.low) && isFinite(c.close) && c.high >= c.low);
      if (candles.length > 0) this.candleHandlers.forEach(h => h(symbol, candles));
    } catch (e) {
      console.warn("[BinanceWS] Erro ao buscar velas:", (e as Error).message);
    }
  }

  unsubscribeAll() {
    if (this.ws?.readyState === WebSocket.OPEN && this.subscribedStreams.size > 0) {
      this.ws.send(JSON.stringify({ method: "UNSUBSCRIBE", params: Array.from(this.subscribedStreams), id: Date.now() }));
    }
    this.subscribedStreams.clear();
  }

  onTick(handler: TickHandler):      () => void { this.tickHandlers.add(handler);    return () => this.tickHandlers.delete(handler); }
  onCandles(handler: CandleHandler): () => void { this.candleHandlers.add(handler);  return () => this.candleHandlers.delete(handler); }
  onConnect(handler: () => void):    () => void { this.connectHandlers.add(handler); return () => this.connectHandlers.delete(handler); }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close(); this.ws = null;
    this.subscribedStreams.clear();
  }
}

export const derivWS = new BinanceWS();
