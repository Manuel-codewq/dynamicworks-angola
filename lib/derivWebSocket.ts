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

export const CRYPTO_PAIRS: DerivPair[] = [
  { symbol: "cryBTCUSD", label: "BTC/USD", category: "Cripto", decimals: 2 },
  { symbol: "cryETHUSD", label: "ETH/USD", category: "Cripto", decimals: 2 },
];

export const COMMODITY_PAIRS: DerivPair[] = [
  { symbol: "frxXAUUSD", label: "Ouro/USD",    category: "Metal", decimals: 2 },
  { symbol: "frxXAGUSD", label: "Prata/USD",   category: "Metal", decimals: 3 },
  { symbol: "frxXPDUSD", label: "Paládio/USD", category: "Metal", decimals: 2 },
  { symbol: "frxXPTUSD", label: "Platina/USD", category: "Metal", decimals: 2 },
];

// 30 pares OTC — cada um usa um índice Deriv 24/7 como fonte de movimento
// Fórmula: displayPrice = forexClose × (indexTick / indexBaseline)
export interface OtcPair extends DerivPair {
  baseSymbol: string; // símbolo do preço base (frxEURUSD, etc.)
  indexSymbol: string; // índice Deriv que conduz o movimento
}

export const OTC_PAIRS: OtcPair[] = [
  // Volatility 1s — tick a cada segundo, movimento contínuo suave
  { symbol: "OTC_EURUSD",  label: "EUR/USD OTC",  category: "Forex OTC", decimals: 5, baseSymbol: "frxEURUSD",  indexSymbol: "1HZ10V"  },
  { symbol: "OTC_GBPUSD",  label: "GBP/USD OTC",  category: "Forex OTC", decimals: 5, baseSymbol: "frxGBPUSD",  indexSymbol: "1HZ25V"  },
  { symbol: "OTC_USDJPY",  label: "USD/JPY OTC",  category: "Forex OTC", decimals: 3, baseSymbol: "frxUSDJPY",  indexSymbol: "1HZ50V"  },
  { symbol: "OTC_AUDUSD",  label: "AUD/USD OTC",  category: "Forex OTC", decimals: 5, baseSymbol: "frxAUDUSD",  indexSymbol: "1HZ75V"  },
  { symbol: "OTC_USDCAD",  label: "USD/CAD OTC",  category: "Forex OTC", decimals: 5, baseSymbol: "frxUSDCAD",  indexSymbol: "1HZ100V" },
  { symbol: "OTC_EURGBP",  label: "EUR/GBP OTC",  category: "Forex OTC", decimals: 5, baseSymbol: "frxEURGBP",  indexSymbol: "1HZ10V"  },
  { symbol: "OTC_USDCHF",  label: "USD/CHF OTC",  category: "Forex OTC", decimals: 5, baseSymbol: "frxUSDCHF",  indexSymbol: "1HZ25V"  },
  { symbol: "OTC_NZDUSD",  label: "NZD/USD OTC",  category: "Forex OTC", decimals: 5, baseSymbol: "frxNZDUSD",  indexSymbol: "1HZ50V"  },
  { symbol: "OTC_EURJPY",  label: "EUR/JPY OTC",  category: "Forex OTC", decimals: 3, baseSymbol: "frxEURJPY",  indexSymbol: "1HZ75V"  },
  { symbol: "OTC_GBPJPY",  label: "GBP/JPY OTC",  category: "Forex OTC", decimals: 3, baseSymbol: "frxGBPJPY",  indexSymbol: "1HZ100V" },
  // Volatility regular — tick a cada 2s, mais suave
  { symbol: "OTC_EURCAD",  label: "EUR/CAD OTC",  category: "Forex OTC", decimals: 5, baseSymbol: "frxEURCAD",  indexSymbol: "R_10"    },
  { symbol: "OTC_AUDJPY",  label: "AUD/JPY OTC",  category: "Forex OTC", decimals: 3, baseSymbol: "frxAUDJPY",  indexSymbol: "R_25"    },
  { symbol: "OTC_GBPAUD",  label: "GBP/AUD OTC",  category: "Forex OTC", decimals: 5, baseSymbol: "frxGBPAUD",  indexSymbol: "R_50"    },
  { symbol: "OTC_EURCHF",  label: "EUR/CHF OTC",  category: "Forex OTC", decimals: 5, baseSymbol: "frxEURCHF",  indexSymbol: "R_75"    },
  { symbol: "OTC_AUDCAD",  label: "AUD/CAD OTC",  category: "Forex OTC", decimals: 5, baseSymbol: "frxAUDCAD",  indexSymbol: "R_100"   },
  // Jump Indices — movimento mais agressivo
  { symbol: "OTC_AUDCHF",  label: "AUD/CHF OTC",  category: "Forex OTC", decimals: 5, baseSymbol: "frxAUDCHF",  indexSymbol: "JD10"    },
  { symbol: "OTC_AUDNZD",  label: "AUD/NZD OTC",  category: "Forex OTC", decimals: 5, baseSymbol: "frxAUDNZD",  indexSymbol: "JD25"    },
  { symbol: "OTC_EURAUD",  label: "EUR/AUD OTC",  category: "Forex OTC", decimals: 5, baseSymbol: "frxEURAUD",  indexSymbol: "JD50"    },
  { symbol: "OTC_EURNZD",  label: "EUR/NZD OTC",  category: "Forex OTC", decimals: 5, baseSymbol: "frxEURNZD",  indexSymbol: "JD75"    },
  { symbol: "OTC_GBPCAD",  label: "GBP/CAD OTC",  category: "Forex OTC", decimals: 5, baseSymbol: "frxGBPCAD",  indexSymbol: "JD100"   },
  // Mix
  { symbol: "OTC_GBPCHF",  label: "GBP/CHF OTC",  category: "Forex OTC", decimals: 5, baseSymbol: "frxGBPCHF",  indexSymbol: "1HZ10V"  },
  { symbol: "OTC_GBPNOK",  label: "GBP/NOK OTC",  category: "Forex OTC", decimals: 3, baseSymbol: "frxGBPNOK",  indexSymbol: "1HZ25V"  },
  { symbol: "OTC_GBPNZD",  label: "GBP/NZD OTC",  category: "Forex OTC", decimals: 5, baseSymbol: "frxGBPNZD",  indexSymbol: "1HZ50V"  },
  { symbol: "OTC_NZDJPY",  label: "NZD/JPY OTC",  category: "Forex OTC", decimals: 3, baseSymbol: "frxNZDJPY",  indexSymbol: "1HZ75V"  },
  { symbol: "OTC_USDMXN",  label: "USD/MXN OTC",  category: "Forex OTC", decimals: 3, baseSymbol: "frxUSDMXN",  indexSymbol: "1HZ100V" },
  { symbol: "OTC_USDNOK",  label: "USD/NOK OTC",  category: "Forex OTC", decimals: 3, baseSymbol: "frxUSDNOK",  indexSymbol: "R_10"    },
  { symbol: "OTC_USDPLN",  label: "USD/PLN OTC",  category: "Forex OTC", decimals: 4, baseSymbol: "frxUSDPLN",  indexSymbol: "R_25"    },
  { symbol: "OTC_USDSEK",  label: "USD/SEK OTC",  category: "Forex OTC", decimals: 3, baseSymbol: "frxUSDSEK",  indexSymbol: "R_50"    },
  { symbol: "OTC_CADJPY",  label: "CAD/JPY OTC",  category: "Forex OTC", decimals: 3, baseSymbol: "frxCADJPY",  indexSymbol: "JD25"    },
  { symbol: "OTC_CHFJPY",  label: "CHF/JPY OTC",  category: "Forex OTC", decimals: 3, baseSymbol: "frxCHFJPY",  indexSymbol: "JD50"    },
];

// Mapa: símbolo OTC → config
export const OTC_MAP = new Map(OTC_PAIRS.map(p => [p.symbol, p]));

// Mapa: símbolo OTC → label para resolução de trades
export const OTC_LABEL_TO_BASE: Record<string, string> = {};
OTC_PAIRS.forEach(p => { OTC_LABEL_TO_BASE[p.label] = p.baseSymbol; });

// Angola WAT = UTC+1. Forex: Seg-Sex 07h-20h WAT (06h-19h UTC)
export function isRealMarketOpen(): boolean {
  if (typeof window === "undefined") return true;
  const now    = new Date();
  const utcDay = now.getUTCDay();
  const utcH   = now.getUTCHours();
  return utcDay >= 1 && utcDay <= 5 && utcH >= 6 && utcH < 19;
}

export function getAvailablePairs(): DerivPair[] {
  if (isRealMarketOpen()) {
    return [...FOREX_PAIRS, ...CRYPTO_PAIRS, ...COMMODITY_PAIRS];
  }
  return [...OTC_PAIRS, ...CRYPTO_PAIRS];
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
  private pendingOtcTarget: { otcSymbol: string; otcPair: OtcPair; forexClose: number } | null = null;
  private tickHandlers    = new Set<TickHandler>();
  private candleHandlers  = new Set<CandleHandler>();
  private connectHandlers = new Set<() => void>();
  private isFirstConnect  = true;

  // OTC state
  // indexBaselines: primeiro tick recebido de cada índice Deriv
  private indexBaselines  = new Map<string, number>();
  // forexCloses: preço de fecho real de cada par base (frxEURUSD, etc.)
  private forexCloses     = new Map<string, number>();
  // activeOtcSymbols: pares OTC activos neste momento
  private activeOtcSymbols = new Set<string>();
  // índices Deriv já subscritossym
  private subscribedIndices = new Set<string>();

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
        const sym   = t.symbol as string;
        const quote = typeof t.quote === "number" ? t.quote : parseFloat(t.quote);
        const epoch = t.epoch as number;

        // Tick de índice Deriv → escalar e emitir para todos os pares OTC que usam este índice
        if (this.activeOtcSymbols.size > 0 && this.isDerivIndex(sym)) {
          // Definir baseline na primeira vez
          if (!this.indexBaselines.has(sym)) {
            this.indexBaselines.set(sym, quote);
          }
          const baseline = this.indexBaselines.get(sym)!;

          // Para cada par OTC que usa este índice, emitir tick escalado
          OTC_PAIRS.forEach(otcPair => {
            if (otcPair.indexSymbol !== sym) return;
            if (!this.activeOtcSymbols.has(otcPair.symbol)) return;

            const forexClose = this.forexCloses.get(otcPair.baseSymbol);
            if (!forexClose) return;

            // displayPrice = forexClose × (indexTick / indexBaseline)
            // Factor de amortecimento: usa 18% do movimento do índice → movimentos suaves como forex real
            const DAMPEN = 0.18;
            const displayPrice = parseFloat((forexClose * (1 + (quote / baseline - 1) * DAMPEN)).toFixed(otcPair.decimals));
            this.tickHandlers.forEach(h => h({ symbol: otcPair.symbol, quote: displayPrice, epoch }));
          });
          return;
        }

        // Tick real (forex, cripto, metal)
        this.tickHandlers.forEach(h => h({ symbol: sym, quote, epoch }));
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

        // Se for histórico de um índice Deriv para um par OTC → escalar e emitir
        if (this.pendingOtcTarget && candles.length > 0) {
          this.scaleAndEmitCandles(sym, this.pendingOtcTarget, candles);
          this.pendingOtcTarget = null;
          return;
        }

        if (candles.length > 0) this.candleHandlers.forEach(h => h(sym, candles));
      }
    };

    this.ws.onclose  = () => { this.ws = null; this.reconnectTimer = setTimeout(() => this.connect(), 3000); };
    this.ws.onerror  = () => { this.ws?.close(); };
  }

  private isDerivIndex(sym: string): boolean {
    return sym.startsWith("1HZ") || sym.startsWith("R_") || sym.startsWith("JD") || sym.startsWith("stpRNG");
  }

  private send(msg: object) {
    if (this.ws?.readyState === WebSocket.OPEN) { this.ws.send(JSON.stringify(msg)); }
    else { this.pendingMessages.push(msg); this.connect(); }
  }

  // Carregar preços de fecho reais do servidor
  async loadForexCloses() {
    try {
      const res = await fetch("/api/prices/otc-config");
      if (!res.ok) return;
      const { closes } = await res.json();
      Object.entries(closes).forEach(([sym, price]) => {
        this.forexCloses.set(sym, price as number);
      });
    } catch { /* silencioso */ }
  }

  subscribeToTicks(symbols: string[]) {
    symbols.forEach(sym => {
      const otcPair = OTC_MAP.get(sym);
      if (otcPair) {
        // Par OTC: marcar como activo e subscrever o índice Deriv correspondente
        this.activeOtcSymbols.add(sym);
        if (!this.subscribedIndices.has(otcPair.indexSymbol)) {
          this.subscribedIndices.add(otcPair.indexSymbol);
          this.send({ ticks: otcPair.indexSymbol, subscribe: 1 });
        }
        return;
      }
      // Par real
      if (!this.subscribedSymbols.has(sym)) {
        this.subscribedSymbols.add(sym);
        this.send({ ticks: sym, subscribe: 1 });
      }
    });
  }

  unsubscribeAll() {
    this.send({ forget_all: "ticks" });
    this.subscribedSymbols.clear();
    this.subscribedIndices.clear();
    this.activeOtcSymbols.clear();
    this.indexBaselines.clear();
  }

  getCandles(symbol: string, granularity: number, count = 150) {
    const otcPair = OTC_MAP.get(symbol);
    if (otcPair) {
      const forexClose = this.forexCloses.get(otcPair.baseSymbol);
      if (forexClose) {
        this.pendingOtcTarget = { otcSymbol: symbol, otcPair, forexClose };
      }
      this.pendingCandleSymbol = otcPair.indexSymbol;
      this.send({ ticks_history: otcPair.indexSymbol, style: "candles", granularity, count, end: "latest" });
      return;
    }
    this.pendingOtcTarget = null;
    this.pendingCandleSymbol = symbol;
    this.send({ ticks_history: symbol, style: "candles", granularity, count, end: "latest" });
  }

  private scaleAndEmitCandles(
    indexSym: string,
    target: { otcSymbol: string; otcPair: OtcPair; forexClose: number },
    rawCandles: DerivCandle[],
  ) {
    const { otcSymbol, otcPair, forexClose } = target;
    const baseline = rawCandles[rawCandles.length - 1].close; // último close do índice como baseline

    // Guardar baseline para futuros ticks
    if (!this.indexBaselines.has(indexSym)) {
      this.indexBaselines.set(indexSym, baseline);
    }

    const scale = (v: number) =>
      parseFloat((forexClose * (1 + (v / baseline - 1) * 0.18)).toFixed(otcPair.decimals));

    const scaled: DerivCandle[] = rawCandles.map(c => ({
      epoch: c.epoch,
      open:  scale(c.open),
      high:  scale(c.high),
      low:   scale(c.low),
      close: scale(c.close),
    }));

    this.candleHandlers.forEach(h => h(otcSymbol, scaled));
  }

  onTick(handler: TickHandler):      () => void { this.tickHandlers.add(handler);    return () => this.tickHandlers.delete(handler); }
  onCandles(handler: CandleHandler): () => void { this.candleHandlers.add(handler);  return () => this.candleHandlers.delete(handler); }
  onConnect(handler: () => void):    () => void { this.connectHandlers.add(handler); return () => this.connectHandlers.delete(handler); }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close(); this.ws = null;
    this.subscribedSymbols.clear(); this.pendingMessages = [];
    this.subscribedIndices.clear();
    this.activeOtcSymbols.clear();
    this.indexBaselines.clear();
  }
}

export const derivWS = new DerivWS();
