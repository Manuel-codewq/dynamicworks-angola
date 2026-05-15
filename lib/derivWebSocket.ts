const DERIV_WS_URL = "wss://ws.binaryws.com/websockets/v3?app_id=127916";

export interface DerivPair {
  symbol:   string;
  label:    string;
  category: string;
  decimals: number;
}

// Todos os pares forex reais disponíveis no Deriv
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
  { symbol: "frxAUDCAD", label: "AUD/CAD", category: "Forex", decimals: 5 },
  { symbol: "frxAUDCHF", label: "AUD/CHF", category: "Forex", decimals: 5 },
  { symbol: "frxAUDNZD", label: "AUD/NZD", category: "Forex", decimals: 5 },
  { symbol: "frxEURAUD", label: "EUR/AUD", category: "Forex", decimals: 5 },
  { symbol: "frxEURNZD", label: "EUR/NZD", category: "Forex", decimals: 5 },
  { symbol: "frxGBPCAD", label: "GBP/CAD", category: "Forex", decimals: 5 },
  { symbol: "frxGBPCHF", label: "GBP/CHF", category: "Forex", decimals: 5 },
  { symbol: "frxGBPNOK", label: "GBP/NOK", category: "Forex", decimals: 3 },
  { symbol: "frxGBPNZD", label: "GBP/NZD", category: "Forex", decimals: 5 },
  { symbol: "frxNZDJPY", label: "NZD/JPY", category: "Forex", decimals: 3 },
  { symbol: "frxUSDMXN", label: "USD/MXN", category: "Forex", decimals: 3 },
  { symbol: "frxUSDNOK", label: "USD/NOK", category: "Forex", decimals: 3 },
  { symbol: "frxUSDPLN", label: "USD/PLN", category: "Forex", decimals: 4 },
  { symbol: "frxUSDSEK", label: "USD/SEK", category: "Forex", decimals: 3 },
];

// Crypto — live 24/7 via Deriv WebSocket
export const CRYPTO_PAIRS: DerivPair[] = [
  { symbol: "cryBTCUSD", label: "BTC/USD", category: "Cripto", decimals: 2 },
  { symbol: "cryETHUSD", label: "ETH/USD", category: "Cripto", decimals: 2 },
];

// Metais preciosos — live 24/5 via Deriv WebSocket
export const COMMODITY_PAIRS: DerivPair[] = [
  { symbol: "frxXAUUSD", label: "Ouro/USD",     category: "Metal", decimals: 2 },
  { symbol: "frxXAGUSD", label: "Prata/USD",    category: "Metal", decimals: 3 },
  { symbol: "frxXPDUSD", label: "Paládio/USD",  category: "Metal", decimals: 2 },
  { symbol: "frxXPTUSD", label: "Platina/USD",  category: "Metal", decimals: 2 },
];

// Pares forex OTC simulados — ativos 24/7 quando o mercado real fecha
export const OTC_FOREX_PAIRS: DerivPair[] = [
  { symbol: "OTC_frxEURUSD", label: "EUR/USD OTC", category: "Forex OTC", decimals: 5 },
  { symbol: "OTC_frxGBPUSD", label: "GBP/USD OTC", category: "Forex OTC", decimals: 5 },
  { symbol: "OTC_frxUSDJPY", label: "USD/JPY OTC", category: "Forex OTC", decimals: 3 },
  { symbol: "OTC_frxAUDUSD", label: "AUD/USD OTC", category: "Forex OTC", decimals: 5 },
  { symbol: "OTC_frxUSDCAD", label: "USD/CAD OTC", category: "Forex OTC", decimals: 5 },
  { symbol: "OTC_frxEURGBP", label: "EUR/GBP OTC", category: "Forex OTC", decimals: 5 },
  { symbol: "OTC_frxUSDCHF", label: "USD/CHF OTC", category: "Forex OTC", decimals: 5 },
  { symbol: "OTC_frxNZDUSD", label: "NZD/USD OTC", category: "Forex OTC", decimals: 5 },
  { symbol: "OTC_frxEURJPY", label: "EUR/JPY OTC", category: "Forex OTC", decimals: 3 },
  { symbol: "OTC_frxGBPJPY", label: "GBP/JPY OTC", category: "Forex OTC", decimals: 3 },
  { symbol: "OTC_frxEURCAD", label: "EUR/CAD OTC", category: "Forex OTC", decimals: 5 },
  { symbol: "OTC_frxAUDJPY", label: "AUD/JPY OTC", category: "Forex OTC", decimals: 3 },
  { symbol: "OTC_frxGBPAUD", label: "GBP/AUD OTC", category: "Forex OTC", decimals: 5 },
  { symbol: "OTC_frxEURCHF", label: "EUR/CHF OTC", category: "Forex OTC", decimals: 5 },
];

// Volatilidade OTC por par (desvio padrão por tick de 1s)
const OTC_VOL: Record<string, number> = {
  OTC_frxEURUSD: 0.00006, OTC_frxGBPUSD: 0.00010, OTC_frxUSDJPY: 0.008,
  OTC_frxAUDUSD: 0.00007, OTC_frxUSDCAD: 0.00008, OTC_frxEURGBP: 0.00005,
  OTC_frxUSDCHF: 0.00007, OTC_frxNZDUSD: 0.00006, OTC_frxEURJPY: 0.009,
  OTC_frxGBPJPY: 0.012,   OTC_frxEURCAD: 0.00009, OTC_frxAUDJPY: 0.007,
  OTC_frxGBPAUD: 0.00012, OTC_frxEURCHF: 0.00006,
};

// Preços base OTC — atualizados com o último preço real quando o mercado fecha
const OTC_BASE: Record<string, number> = {
  OTC_frxEURUSD: 1.08500, OTC_frxGBPUSD: 1.26500, OTC_frxUSDJPY: 149.500,
  OTC_frxAUDUSD: 0.65200, OTC_frxUSDCAD: 1.36200, OTC_frxEURGBP: 0.85800,
  OTC_frxUSDCHF: 0.89700, OTC_frxNZDUSD: 0.60700, OTC_frxEURJPY: 162.500,
  OTC_frxGBPJPY: 188.700, OTC_frxEURCAD: 1.47500, OTC_frxAUDJPY: 97.500,
  OTC_frxGBPAUD: 1.96500, OTC_frxEURCHF: 0.96800,
};

// Angola = WAT (UTC+1). Mercado real: Seg-Sex 07h-20h WAT (06h-19h UTC)
export function isRealMarketOpen(): boolean {
  if (typeof window === "undefined") return true;
  const now    = new Date();
  const utcDay = now.getUTCDay();
  const utcH   = now.getUTCHours();
  return utcDay >= 1 && utcDay <= 5 && utcH >= 6 && utcH < 19;
}

export function getAvailablePairs(): DerivPair[] {
  if (typeof window === "undefined") {
    return [...FOREX_PAIRS, ...OTC_FOREX_PAIRS, ...CRYPTO_PAIRS, ...COMMODITY_PAIRS];
  }
  if (isRealMarketOpen()) {
    // Mercado aberto: Forex real + Forex OTC + Cripto + Metal
    return [...FOREX_PAIRS, ...OTC_FOREX_PAIRS, ...CRYPTO_PAIRS, ...COMMODITY_PAIRS];
  }
  // Fora de horário: só OTC forex + Cripto (metal fecha com o forex)
  return [...OTC_FOREX_PAIRS, ...CRYPTO_PAIRS];
}

export const GRANULARITY: Record<string, number> = {
  "1m": 60, "5m": 300, "15m": 900, "1h": 3600, "1D": 86400,
};

export interface DerivTick   { symbol: string; quote: number; epoch: number; }
export interface DerivCandle { epoch: number; open: number; high: number; low: number; close: number; }

type TickHandler   = (tick: DerivTick) => void;
type CandleHandler = (symbol: string, candles: DerivCandle[]) => void;

// Gera candles simuladas para OTC forex com mean-reversion
function generateOtcCandles(symbol: string, granularity: number, count: number): DerivCandle[] {
  const vol    = OTC_VOL[symbol] ?? 0.00007;
  const base   = OTC_BASE[symbol] ?? 1.0;
  const now    = Math.floor(Date.now() / 1000);
  const start  = now - count * granularity;
  const candles: DerivCandle[] = [];

  let price    = base;
  let momentum = 0;

  for (let i = 0; i < count; i++) {
    const epoch    = start + i * granularity;
    const drift    = (base - price) * 0.02;
    momentum       = momentum * 0.6 + (Math.random() - 0.5) * vol * 2 + drift;
    const open     = price;
    const close    = Math.max(price + momentum, price * 0.98);
    const bodyHigh = Math.max(open, close);
    const bodyLow  = Math.min(open, close);
    const wick     = vol * (0.5 + Math.random() * 1.5);
    const high     = bodyHigh + Math.random() * wick;
    const low      = Math.max(bodyLow - Math.random() * wick, price * 0.97);

    candles.push({ epoch, open, high, low, close });
    price = close;
  }

  OTC_BASE[symbol] = price;
  return candles;
}

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

  // OTC simulator state
  private otcTimers = new Map<string, ReturnType<typeof setInterval>>();
  private otcPrices = new Map<string, number>();

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    this.ws = new WebSocket(DERIV_WS_URL);

    this.ws.onopen = () => {
      const q = this.pendingMessages.splice(0);
      q.forEach(m => this.ws!.send(JSON.stringify(m)));
      this.subscribedSymbols.forEach(sym =>
        this.ws!.send(JSON.stringify({ ticks: sym, subscribe: 1 }))
      );
      if (!this.isFirstConnect) this.connectHandlers.forEach(h => h());
      this.isFirstConnect = false;
    };

    this.ws.onmessage = (e) => {
      let data: any;
      try { data = JSON.parse(e.data); } catch { return; }
      if (data.error) return;
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

  private startOtcTicker(symbol: string) {
    if (this.otcTimers.has(symbol)) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/prices/current?symbols=${symbol}`);
        if (!res.ok) return;
        const data: Record<string, number> = await res.json();
        const price = data[symbol];
        if (!price || price <= 0) return;
        this.otcPrices.set(symbol, price);
        const epoch = Math.floor(Date.now() / 1000);
        this.tickHandlers.forEach(h => h({ symbol, quote: price, epoch }));
      } catch { /* falha silenciosa */ }
    };

    poll(); // tick imediato
    const timer = setInterval(poll, 1000);
    this.otcTimers.set(symbol, timer);
  }

  private stopOtcTicker(symbol: string) {
    const t = this.otcTimers.get(symbol);
    if (t) { clearInterval(t); this.otcTimers.delete(symbol); }
  }

  subscribeToTicks(symbols: string[]) {
    symbols.forEach(sym => {
      if (sym.startsWith("OTC_frx")) {
        this.startOtcTicker(sym);
        return;
      }
      if (!this.subscribedSymbols.has(sym)) {
        this.subscribedSymbols.add(sym);
        this.send({ ticks: sym, subscribe: 1 });
      }
    });
  }

  unsubscribeAll() {
    this.send({ forget_all: "ticks" });
    this.subscribedSymbols.clear();
    this.otcTimers.forEach((_, sym) => this.stopOtcTicker(sym));
  }

  getCandles(symbol: string, granularity: number, count = 150) {
    if (symbol.startsWith("OTC_frx")) {
      const candles = generateOtcCandles(symbol, granularity, count);
      setTimeout(() => { this.candleHandlers.forEach(h => h(symbol, candles)); }, 0);
      return;
    }
    this.pendingCandleSymbol = symbol;
    this.send({ ticks_history: symbol, style: "candles", granularity, count, end: "latest" });
  }

  // Atualiza o preço base OTC com o último preço real
  seedOtcPrice(forexSymbol: string, price: number) {
    const otcSym = "OTC_" + forexSymbol;
    if (OTC_BASE[otcSym] !== undefined) {
      OTC_BASE[otcSym] = price;
      this.otcPrices.set(otcSym, price);
    }
  }

  // Carrega os últimos preços reais do servidor e semeia o OTC_BASE
  async seedOtcFromServer() {
    try {
      const res = await fetch("/api/prices/otc");
      if (!res.ok) return;
      const prices: Record<string, number> = await res.json();
      Object.entries(prices).forEach(([symbol, price]) => {
        this.seedOtcPrice(symbol, price);
      });
    } catch { /* falha silenciosa — usa fallback hardcoded */ }
  }

  onTick(handler: TickHandler):      () => void { this.tickHandlers.add(handler);    return () => this.tickHandlers.delete(handler); }
  onCandles(handler: CandleHandler): () => void { this.candleHandlers.add(handler);  return () => this.candleHandlers.delete(handler); }
  onConnect(handler: () => void):    () => void { this.connectHandlers.add(handler); return () => this.connectHandlers.delete(handler); }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close(); this.ws = null;
    this.subscribedSymbols.clear(); this.pendingMessages = [];
    this.otcTimers.forEach((_, sym) => this.stopOtcTicker(sym));
  }
}

export const derivWS = new DerivWS();
