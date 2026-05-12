const DERIV_WS_URL = "wss://ws.binaryws.com/websockets/v3?app_id=127916";

export interface DerivPair {
  symbol:   string;
  label:    string;
  category: string;
  decimals: number;
}

export const FOREX_PAIRS: DerivPair[] = [
  { symbol: "frxEURUSD", label: "EUR/USD", category: "Forex", decimals: 5 },
  { symbol: "frxGBPUSD", label: "GBP/USD", category: "Forex", decimals: 5 },
  { symbol: "frxUSDJPY", label: "USD/JPY", category: "Forex", decimals: 3 },
  { symbol: "frxAUDUSD", label: "AUD/USD", category: "Forex", decimals: 5 },
  { symbol: "frxUSDCAD", label: "USD/CAD", category: "Forex", decimals: 5 },
  { symbol: "frxEURGBP", label: "EUR/GBP", category: "Forex", decimals: 5 },
  { symbol: "frxUSDCHF", label: "USD/CHF", category: "Forex", decimals: 5 },
  { symbol: "frxNZDUSD", label: "NZD/USD", category: "Forex", decimals: 5 },
  { symbol: "frxEURJPY", label: "EUR/JPY", category: "Forex", decimals: 3 },
  { symbol: "frxGBPJPY", label: "GBP/JPY", category: "Forex", decimals: 3 },
  { symbol: "frxEURCAD", label: "EUR/CAD", category: "Forex", decimals: 5 },
  { symbol: "frxAUDJPY", label: "AUD/JPY", category: "Forex", decimals: 3 },
  { symbol: "frxGBPAUD", label: "GBP/AUD", category: "Forex", decimals: 5 },
  { symbol: "frxEURCHF", label: "EUR/CHF", category: "Forex", decimals: 5 },
];

// Crypto — live 24/7 via Deriv WebSocket
export const CRYPTO_PAIRS: DerivPair[] = [
  { symbol: "cryBTCUSD", label: "BTC/USD", category: "Cripto", decimals: 2 },
  { symbol: "cryETHUSD", label: "ETH/USD", category: "Cripto", decimals: 2 },
];

// Commodities — live 24/5 via Deriv WebSocket
export const COMMODITY_PAIRS: DerivPair[] = [
  { symbol: "frxXAUUSD", label: "XAU/USD", category: "Metal", decimals: 2 },
  { symbol: "frxXAGUSD", label: "XAG/USD", category: "Metal", decimals: 3 },
];

// Índices sintéticos 24/7 — nomes internos Dynamics Works (não expõem o fornecedor)
export const SYNTHETIC_PAIRS: DerivPair[] = [
  { symbol: "1HZ10V",    label: "DW Index 10",   category: "Sintético", decimals: 3 },
  { symbol: "1HZ25V",    label: "DW Index 25",   category: "Sintético", decimals: 3 },
  { symbol: "1HZ50V",    label: "DW Index 50",   category: "Sintético", decimals: 4 },
  { symbol: "1HZ75V",    label: "DW Index 75",   category: "Sintético", decimals: 4 },
  { symbol: "1HZ100V",   label: "DW Index 100",  category: "Sintético", decimals: 2 },
  { symbol: "BOOM300N",  label: "DW Subida 300", category: "Sintético", decimals: 2 },
  { symbol: "CRASH300N", label: "DW Queda 300",  category: "Sintético", decimals: 2 },
  { symbol: "BOOM500",   label: "DW Subida 500", category: "Sintético", decimals: 2 },
  { symbol: "CRASH500",  label: "DW Queda 500",  category: "Sintético", decimals: 2 },
];

// Angola = WAT (UTC+1). Mercado real: Seg-Sex 07h-18h WAT (06h-17h UTC)
export function isRealMarketOpen(): boolean {
  if (typeof window === "undefined") return true;
  const now    = new Date();
  const utcDay = now.getUTCDay();   // 0=Dom, 6=Sab
  const utcH   = now.getUTCHours();
  const isWeekday = utcDay >= 1 && utcDay <= 5;
  return isWeekday && utcH >= 6 && utcH < 17; // 07h–18h WAT
}

export function getAvailablePairs(): DerivPair[] {
  if (typeof window === "undefined") {
    return [...FOREX_PAIRS, ...CRYPTO_PAIRS, ...COMMODITY_PAIRS, ...SYNTHETIC_PAIRS];
  }
  if (isRealMarketOpen()) {
    return [...FOREX_PAIRS, ...CRYPTO_PAIRS, ...COMMODITY_PAIRS];
  }
  // Fora de horário (após 18h WAT ou fim de semana) → só sintéticos 24/7
  return [...SYNTHETIC_PAIRS];
}

export const GRANULARITY: Record<string, number> = {
  "1m": 60, "5m": 300, "15m": 900, "1h": 3600, "1D": 86400,
};

export interface DerivTick   { symbol: string; quote: number; epoch: number; }
export interface DerivCandle { epoch: number; open: number; high: number; low: number; close: number; }

type TickHandler   = (tick: DerivTick) => void;
type CandleHandler = (symbol: string, candles: DerivCandle[]) => void;

export class DerivWS {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingMessages: object[] = [];
  private subscribedSymbols = new Set<string>();
  private pendingCandleSymbol = "";
  private tickHandlers    = new Set<TickHandler>();
  private candleHandlers  = new Set<CandleHandler>();
  private connectHandlers = new Set<() => void>();
  private isFirstConnect  = true;

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    this.ws = new WebSocket(DERIV_WS_URL);

    this.ws.onopen = () => {
      const q = this.pendingMessages.splice(0);
      q.forEach(m => this.ws!.send(JSON.stringify(m)));
      this.subscribedSymbols.forEach(sym =>
        this.ws!.send(JSON.stringify({ ticks: sym, subscribe: 1 }))
      );
      // Notify reconnect listeners (skip very first connect — pair effect handles it)
      if (!this.isFirstConnect) this.connectHandlers.forEach(h => h());
      this.isFirstConnect = false;
    };

    this.ws.onmessage = (e) => {
      let data: any;
      try { data = JSON.parse(e.data); } catch { return; }
      if (data.error) return; // market closed etc — silently ignore
      if (data.tick) {
        const t = data.tick;
        this.tickHandlers.forEach(h => h({
          symbol: t.symbol,
          quote:  typeof t.quote === "number" ? t.quote : parseFloat(t.quote),
          epoch:  t.epoch,
        }));
      }
      if (data.candles && Array.isArray(data.candles)) {
        const sym = data.echo_req?.ticks_history ?? this.pendingCandleSymbol;
        const candles: DerivCandle[] = data.candles
          .map((c: any) => ({
            epoch: Number(c.epoch),
            open:  parseFloat(c.open),
            high:  parseFloat(c.high),
            low:   parseFloat(c.low),
            close: parseFloat(c.close),
          }))
          .filter((c: DerivCandle) =>
            isFinite(c.open) && isFinite(c.high) && isFinite(c.low) && isFinite(c.close) && c.high >= c.low
          );
        if (candles.length > 0) this.candleHandlers.forEach(h => h(sym, candles));
      }
    };

    this.ws.onclose  = () => { this.ws = null; this.reconnectTimer = setTimeout(() => this.connect(), 3000); };
    this.ws.onerror  = () => { this.ws?.close(); };
  }

  private send(msg: object) {
    if (this.ws?.readyState === WebSocket.OPEN) { this.ws.send(JSON.stringify(msg)); }
    else { this.pendingMessages.push(msg); this.connect(); }
  }

  subscribeToTicks(symbols: string[]) {
    symbols.forEach(sym => {
      if (!this.subscribedSymbols.has(sym)) {
        this.subscribedSymbols.add(sym);
        this.send({ ticks: sym, subscribe: 1 });
      }
    });
  }

  unsubscribeAll() {
    this.send({ forget_all: "ticks" });
    this.subscribedSymbols.clear();
  }

  getCandles(symbol: string, granularity: number, count = 150) {
    this.pendingCandleSymbol = symbol;
    this.send({ ticks_history: symbol, style: "candles", granularity, count, end: "latest" });
  }

  onTick(handler: TickHandler):      () => void { this.tickHandlers.add(handler);    return () => this.tickHandlers.delete(handler); }
  onCandles(handler: CandleHandler): () => void { this.candleHandlers.add(handler);  return () => this.candleHandlers.delete(handler); }
  onConnect(handler: () => void):    () => void { this.connectHandlers.add(handler); return () => this.connectHandlers.delete(handler); }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close(); this.ws = null;
    this.subscribedSymbols.clear(); this.pendingMessages = [];
  }
}

export const derivWS = new DerivWS();
