"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  TrendingUp, TrendingDown, ChevronDown, Wallet,
  User, LogOut, BarChart2, AlertCircle, X, Trophy,
  Clock, History,
} from "lucide-react";
import {
  createChart, IChartApi, ISeriesApi, CandlestickData, Time,
  CandlestickSeries, LineSeries, HistogramSeries,
} from "lightweight-charts";
import {
  derivWS, GRANULARITY, getAvailablePairs,
  type DerivPair, type DerivCandle,
} from "@/lib/derivWebSocket";
import NotificationBell from "@/app/components/NotificationBell";
import { calcSMA, calcEMA, calcBB, calcRSI, calcMACD, calcStochastic } from "@/lib/indicators";

// ── Constants ────────────────────────────────────────────────────────────────

const EXPIRY_OPTIONS = [
  { label: "1 min",  secs: 60   },
  { label: "5 min",  secs: 300  },
  { label: "15 min", secs: 900  },
  { label: "1 hora", secs: 3600 },
];

const QUICK_AMOUNTS = [1000, 5000, 10000, 25000];

// Approximate initial prices for placeholder candles while WS connects
const SEED_PRICES: Record<string, number> = {
  // Forex
  frxEURUSD: 1.085,  frxGBPUSD: 1.265,  frxUSDJPY: 149.5,
  frxAUDUSD: 0.652,  frxUSDCAD: 1.362,  frxEURGBP: 0.858,
  frxUSDCHF: 0.897,  frxNZDUSD: 0.607,
  frxEURJPY: 162.5,  frxGBPJPY: 188.7,  frxEURCAD: 1.475,
  frxAUDJPY: 97.5,   frxGBPAUD: 1.965,  frxEURCHF: 0.968,
  // Crypto
  cryBTCUSD: 60000,  cryETHUSD: 3200,
  // Commodities
  frxXAUUSD: 2350,   frxXAGUSD: 27.5,
  // Synthetic indices
  R_10: 6300, R_25: 5800, R_50: 4500, R_75: 3700, R_100: 9800,
  BOOM300: 7800, CRASH300: 7800,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatKz(n: number) {
  return n.toLocaleString("pt-AO") + " Kz";
}

// Placeholder candles — shown while WS data loads (correct OHLC invariants)
function generatePlaceholder(basePrice: number, count = 100, gran = 60): CandlestickData[] {
  const map = new Map<number, CandlestickData>();
  const now  = Math.floor(Date.now() / gran) * gran;
  const maxSpread = basePrice * 0.012;
  let price    = basePrice;
  let momentum = 0;

  for (let i = count; i >= 0; i--) {
    const t = now - i * gran;
    momentum = momentum * 0.75 + (Math.random() - 0.5) * maxSpread * 0.7;
    const open  = price;
    const close = price + momentum;
    if (!isFinite(open) || !isFinite(close) || open === 0) continue;

    const bodyHigh = Math.max(open, close);
    const bodyLow  = Math.min(open, close);
    const wick     = maxSpread * (0.3 + Math.random() * 0.5);
    const safeHigh = bodyHigh + Math.random() * wick;
    const safeLow  = bodyLow  - Math.random() * wick;

    if (!isFinite(safeHigh) || !isFinite(safeLow) || safeHigh < safeLow) continue;
    map.set(t, { time: t as Time, open, high: safeHigh, low: safeLow, close });
    price = close;
  }
  return Array.from(map.values()).sort((a, b) => (a.time as number) - (b.time as number));
}

// Convert Deriv candles to lightweight-charts format (validates invariants)
function toChartCandles(raw: DerivCandle[]): CandlestickData[] {
  const map = new Map<number, CandlestickData>();
  for (const c of raw) {
    const safeHigh = Math.max(c.high, c.open, c.close);
    const safeLow  = Math.min(c.low,  c.open, c.close);
    if (!isFinite(safeHigh) || !isFinite(safeLow) || safeHigh < safeLow) continue;
    map.set(c.epoch, { time: c.epoch as Time, open: c.open, high: safeHigh, low: safeLow, close: c.close });
  }
  return Array.from(map.values()).sort((a, b) => (a.time as number) - (b.time as number));
}

// ── Types ────────────────────────────────────────────────────────────────────

interface ActiveTrade {
  id: string; asset: string; direction: string;
  amount: number; entryPrice: number; expirySecs: number;
  createdAt: string; payout: number;
  expiresAt: number; // client epoch ms — recalibrated by each poll
}
interface RecentWin { name: string; amount: number; time: number; }

// ── Component ────────────────────────────────────────────────────────────────

export default function TradePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // ── Responsive ──────────────────────────────────────────────────────────
  const [isMobile, setIsMobile]       = useState(false);
  const [windowHeight, setWindowHeight] = useState(0);
  useEffect(() => {
    const check = () => { setIsMobile(window.innerWidth < 768); setWindowHeight(window.innerHeight); };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ── Available pairs — polls /api/market-mode every 15s (reacts to admin changes) ─
  const [pairs,        setPairs]        = useState<DerivPair[]>([]);
  const [selectedPair, setSelectedPair] = useState<DerivPair | null>(null);

  useEffect(() => {
    const list = getAvailablePairs();
    setPairs(list);
    setSelectedPair(list[0]);
  }, []); // eslint-disable-line

  // ── UI state ─────────────────────────────────────────────────────────────
  const [assetDropdown, setAssetDropdown] = useState(false);
  const [currentPrice,  setCurrentPrice]  = useState(0);
  const [priceUp,       setPriceUp]       = useState(true);
  const [amount,        setAmount]        = useState(1000);
  const [expiry,        setExpiry]        = useState(EXPIRY_OPTIONS[0]);
  const [customMins,   setCustomMins]    = useState("1");
  const [isDemo,        setIsDemo]        = useState(true);
  const [balance,       setBalance]       = useState(10000);
  const [demoBalance,   setDemoBalance]   = useState(10000);
  const [activeTrades,  setActiveTrades]  = useState<ActiveTrade[]>([]);
  const [recentWins,    setRecentWins]    = useState<RecentWin[]>([]);
  const [sentiment,     setSentiment]     = useState(62);
  const [loading,       setLoading]       = useState(false);
  const [notification,  setNotification]  = useState<{ msg: string; type: "win" | "loss" | "info" } | null>(null);
  const [mobileTab,     setMobileTab]     = useState<"chart" | "trade" | "wallet" | "account">("chart");
  const [tradeDrawer,   setTradeDrawer]   = useState(false);
  const [timeframe,      setTimeframe]      = useState("1m");
  const [tickerPrices,   setTickerPrices]   = useState<Record<string, number>>({});
  const [userMenuOpen,   setUserMenuOpen]   = useState(false);
  const [demoReloading,  setDemoReloading]  = useState(false);
  const [candleTimer,    setCandleTimer]    = useState("");
  const [payoutMap,      setPayoutMap]      = useState<Record<string, number>>({});
  const [, setTick]                         = useState(0);
  const [showTradesPanel, setShowTradesPanel] = useState(false);
  const [tradeHistoryTab, setTradeHistoryTab] = useState<"open" | "history">("open");
  const [tradeHistory,    setTradeHistory]    = useState<any[]>([]);
  const [timerEditing,    setTimerEditing]    = useState(false);
  const [timerInput,      setTimerInput]      = useState("");
  const [amountEditing,   setAmountEditing]   = useState(false);
  const [amountInput,     setAmountInput]     = useState("");

  // ── Refs ─────────────────────────────────────────────────────────────────
  const chartRef           = useRef<HTMLDivElement>(null);
  const chartApiRef        = useRef<IChartApi | null>(null);
  const candleSeriesRef    = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const currentCandleRef   = useRef<CandlestickData | null>(null);
  const lastPriceRef       = useRef<number>(0);
  const reconnectingRef    = useRef<boolean>(false);
  const tradePriceLinesRef = useRef<Map<string, any>>(new Map());
  const livePriceLineRef   = useRef<any>(null);
  const activeTradesRef    = useRef<ActiveTrade[]>([]);
  // Tracks the Deriv server epoch of the current candle's open (used to sync the countdown timer)
  const currentCandleEpochRef = useRef<number>(0);
  // Stable refs for use inside WS callbacks (avoid stale closures)
  const selectedPairRef  = useRef<DerivPair | null>(null);
  const timeframeRef     = useRef<string>("1m");

  useEffect(() => { selectedPairRef.current = selectedPair; }, [selectedPair]);
  useEffect(() => { timeframeRef.current = timeframe; },       [timeframe]);

  // ── Indicator state + refs ───────────────────────────────────────────────
  const [showIndicators, setShowIndicators] = useState(false);

  const DEFAULT_INDICATORS = {
    ma:    { enabled: false, periods: [20] as number[] },
    ema:   { enabled: false, periods: [20] as number[] },
    bb:    { enabled: false, period: 20 },
    rsi:   { enabled: false, period: 14 },
    macd:  { enabled: false, fast: 12, slow: 26, signal: 9 },
    stoch: { enabled: false, kPeriod: 14, dPeriod: 3 },
  };
  type IndicatorState = typeof DEFAULT_INDICATORS;
  function loadIndicators(): IndicatorState {
    try {
      const raw = localStorage.getItem("dw_indicators");
      if (raw) {
        const p = JSON.parse(raw) as any;
        const migrateMA = (key: "ma" | "ema") => {
          const s = p[key] ?? {};
          // migrate old {period:N} → {periods:[N]}
          const periods: number[] = s.periods ?? (s.period ? [s.period] : DEFAULT_INDICATORS[key].periods);
          return { ...DEFAULT_INDICATORS[key], ...s, periods };
        };
        return {
          ma:    migrateMA("ma"),
          ema:   migrateMA("ema"),
          bb:    { ...DEFAULT_INDICATORS.bb,    ...(p.bb    ?? {}) },
          rsi:   { ...DEFAULT_INDICATORS.rsi,   ...(p.rsi   ?? {}) },
          macd:  { ...DEFAULT_INDICATORS.macd,  ...(p.macd  ?? {}) },
          stoch: { ...DEFAULT_INDICATORS.stoch, ...(p.stoch ?? {}) },
        };
      }
    } catch {}
    return DEFAULT_INDICATORS;
  }
  const [indicators, setIndicators] = useState<IndicatorState>(loadIndicators);

  // Persist to localStorage immediately (fast, works offline)
  useEffect(() => {
    try { localStorage.setItem("dw_indicators", JSON.stringify(indicators)); } catch {}
  }, [indicators]);

  // On login: load from DB (source of truth across devices), debounced save on change
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/preferences")
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d?.indicatorPrefs) return;
        const p = d.indicatorPrefs as Partial<IndicatorState>;
        setIndicators({
          ma:    { ...DEFAULT_INDICATORS.ma,    ...(p.ma    ?? {}) },
          ema:   { ...DEFAULT_INDICATORS.ema,   ...(p.ema   ?? {}) },
          bb:    { ...DEFAULT_INDICATORS.bb,    ...(p.bb    ?? {}) },
          rsi:   { ...DEFAULT_INDICATORS.rsi,   ...(p.rsi   ?? {}) },
          macd:  { ...DEFAULT_INDICATORS.macd,  ...(p.macd  ?? {}) },
          stoch: { ...DEFAULT_INDICATORS.stoch, ...(p.stoch ?? {}) },
        });
      })
      .catch(() => {});
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (status !== "authenticated") return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      fetch("/api/preferences", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ indicatorPrefs: indicators }),
      }).catch(() => {});
    }, 1500);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [indicators, status]); // eslint-disable-line react-hooks/exhaustive-deps
  const indicatorsRef  = useRef(indicators);
  const candleDataRef  = useRef<CandlestickData[]>([]);
  const maSeriesRefs   = useRef<Map<number, ISeriesApi<"Line">>>(new Map());
  const emaSeriesRefs  = useRef<Map<number, ISeriesApi<"Line">>>(new Map());
  const bbUpperRef     = useRef<ISeriesApi<"Line"> | null>(null);
  const bbMiddleRef    = useRef<ISeriesApi<"Line"> | null>(null);
  const bbLowerRef     = useRef<ISeriesApi<"Line"> | null>(null);
  const rsiSeriesRef   = useRef<ISeriesApi<"Line"> | null>(null);
  const rsiPaneRef     = useRef<any>(null);
  const macdLineRef    = useRef<ISeriesApi<"Line"> | null>(null);
  const macdSignalRef  = useRef<ISeriesApi<"Line"> | null>(null);
  const macdHistRef    = useRef<ISeriesApi<"Histogram"> | null>(null);
  const macdPaneRef    = useRef<any>(null);
  const stochKRef      = useRef<ISeriesApi<"Line"> | null>(null);
  const stochDRef      = useRef<ISeriesApi<"Line"> | null>(null);
  const stochPaneRef   = useRef<any>(null);
  const recalcRef          = useRef<() => void>(() => {});
  const [legend, setLegend] = useState<{ label: string; value: string; color: string }[]>([]);
  const lastLegendRef      = useRef<{ label: string; value: string; color: string }[]>([]);
  const closingTradesRef   = useRef(new Set<string>()); // trades com pedido de fecho em voo
  const notifiedTradesRef  = useRef(new Set<string>()); // trades para as quais já mostrámos notificação
  const closeAttemptsRef   = useRef(new Map<string, number>()); // nº tentativas de fecho por trade
  const closeLastAtRef     = useRef(new Map<string, number>()); // timestamp última tentativa por trade
  // Trades abertos nesta sessão — só estes mostram notificação win/loss
  const sessionTradeIdsRef = useRef(new Set<string>());
  // setTimeout IDs para trades desta sessão — garante expiração exacta como o demo HTML
  const tradeTimersRef     = useRef(new Map<string, ReturnType<typeof setTimeout>>());


  // ── Candle countdown timer — pure UTC alignment ──────────────────────────
  // Deriv epoch and Date.now() are both UTC. gran - (nowSec % gran) always
  // gives [1..gran], so 1m can never exceed 1:00, 5m never 5:00, etc.
  useEffect(() => {
    function update() {
      const gran   = GRANULARITY[timeframe] ?? 60;
      const nowSec = Math.floor(Date.now() / 1000);
      const rem    = gran - (nowSec % gran);
      setCandleTimer(`${Math.floor(rem / 60)}:${String(rem % 60).padStart(2, "0")}`);
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [timeframe]);

  useEffect(() => { indicatorsRef.current = indicators; }, [indicators]);


  // ── Indicator recalc — rebuilds all indicator series from candleDataRef ──
  // Defined as a standalone function (not useCallback) so it always captures
  // the current refs without needing to be listed as a dependency anywhere.
  // Colors for MA/EMA multi-period lines
  const MA_COLORS:  Record<number, string> = { 9: "#f5a623", 20: "#3b82f6", 50: "#a78bfa" };
  const EMA_COLORS: Record<number, string> = { 9: "#fbbf24", 20: "#60a5fa", 50: "#c084fc" };

  function runRecalc(cfg: typeof indicators) {
    const chart = chartApiRef.current;
    const data  = candleDataRef.current;
    if (!chart || data.length < 2) return;

    const visibleRange = chart.timeScale().getVisibleRange();
    const dec = selectedPairRef.current?.decimals ?? 5;
    const leg: typeof legend = [];

    const lineOpts = { priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: false } as const;

    // ── MA (multiple periods) ──
    if (cfg.ma.enabled && cfg.ma.periods.length > 0) {
      const active = new Set(cfg.ma.periods);
      maSeriesRefs.current.forEach((s, p) => {
        if (!active.has(p)) { chart.removeSeries(s); maSeriesRefs.current.delete(p); }
      });
      cfg.ma.periods.forEach(p => {
        const color = MA_COLORS[p] ?? "#f5a623";
        if (!maSeriesRefs.current.has(p))
          maSeriesRefs.current.set(p, chart.addSeries(LineSeries, { ...lineOpts, color, lineWidth: 2 }));
        const d = calcSMA(data, p);
        maSeriesRefs.current.get(p)!.setData(d);
        if (d.length > 0) leg.push({ label: `MA ${p}`, value: d[d.length - 1].value.toFixed(dec), color });
      });
    } else if (!cfg.ma.enabled) {
      maSeriesRefs.current.forEach(s => chart.removeSeries(s));
      maSeriesRefs.current.clear();
    }

    // ── EMA (multiple periods) ──
    if (cfg.ema.enabled && cfg.ema.periods.length > 0) {
      const active = new Set(cfg.ema.periods);
      emaSeriesRefs.current.forEach((s, p) => {
        if (!active.has(p)) { chart.removeSeries(s); emaSeriesRefs.current.delete(p); }
      });
      cfg.ema.periods.forEach(p => {
        const color = EMA_COLORS[p] ?? "#a78bfa";
        if (!emaSeriesRefs.current.has(p))
          emaSeriesRefs.current.set(p, chart.addSeries(LineSeries, { ...lineOpts, color, lineWidth: 2 }));
        const d = calcEMA(data, p);
        emaSeriesRefs.current.get(p)!.setData(d);
        if (d.length > 0) leg.push({ label: `EMA ${p}`, value: d[d.length - 1].value.toFixed(dec), color });
      });
    } else if (!cfg.ema.enabled) {
      emaSeriesRefs.current.forEach(s => chart.removeSeries(s));
      emaSeriesRefs.current.clear();
    }

    // ── Bollinger Bands ──
    if (cfg.bb.enabled) {
      const bb = calcBB(data, cfg.bb.period);
      if (!bbUpperRef.current) {
        const o = { priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, lineWidth: 1 } as const;
        bbUpperRef.current  = chart.addSeries(LineSeries, { ...o, color: "#38bdf8" });
        bbMiddleRef.current = chart.addSeries(LineSeries, { ...o, color: "#38bdf860", lineStyle: 2 });
        bbLowerRef.current  = chart.addSeries(LineSeries, { ...o, color: "#38bdf8" });
      }
      bbUpperRef.current.setData(bb.upper);
      bbMiddleRef.current!.setData(bb.middle);
      bbLowerRef.current!.setData(bb.lower);
      if (bb.upper.length > 0) {
        leg.push({ label: `BB↑ ${cfg.bb.period}`, value: bb.upper[bb.upper.length - 1].value.toFixed(dec), color: "#38bdf8" });
        leg.push({ label: `BB↓`, value: bb.lower[bb.lower.length - 1].value.toFixed(dec), color: "#38bdf880" });
      }
    } else if (bbUpperRef.current) {
      chart.removeSeries(bbUpperRef.current);  bbUpperRef.current  = null;
      chart.removeSeries(bbMiddleRef.current!); bbMiddleRef.current = null;
      chart.removeSeries(bbLowerRef.current!);  bbLowerRef.current  = null;
    }

    // ── RSI (new pane) with 70/30/50 reference lines ──
    if (cfg.rsi.enabled) {
      if (!rsiSeriesRef.current) {
        const paneIdx = chart.panes().length;
        rsiSeriesRef.current = chart.addSeries(LineSeries, { ...lineOpts, color: "#f97316", lineWidth: 2 }, paneIdx);
        rsiPaneRef.current   = chart.panes()[paneIdx];
        rsiSeriesRef.current.createPriceLine({ price: 70, color: "#ef444470", lineWidth: 1, lineStyle: 2, axisLabelVisible: true,  title: "OB" });
        rsiSeriesRef.current.createPriceLine({ price: 50, color: "#64748b50", lineWidth: 1, lineStyle: 1, axisLabelVisible: false, title: "" });
        rsiSeriesRef.current.createPriceLine({ price: 30, color: "#22c55e70", lineWidth: 1, lineStyle: 2, axisLabelVisible: true,  title: "OS" });
      }
      const rsiData = calcRSI(data, cfg.rsi.period);
      rsiSeriesRef.current.setData(rsiData);
      if (rsiData.length > 0) leg.push({ label: `RSI ${cfg.rsi.period}`, value: rsiData[rsiData.length - 1].value.toFixed(1), color: "#f97316" });
    } else if (rsiSeriesRef.current) {
      chart.removeSeries(rsiSeriesRef.current);
      rsiSeriesRef.current = null;
      if (rsiPaneRef.current) {
        const idx = chart.panes().indexOf(rsiPaneRef.current);
        if (idx > 0) try { chart.removePane(idx); } catch {}
        rsiPaneRef.current = null;
      }
    }

    // ── MACD (new pane) with zero line ──
    if (cfg.macd.enabled) {
      const m = calcMACD(data, cfg.macd.fast, cfg.macd.slow, cfg.macd.signal);
      if (!macdLineRef.current) {
        const paneIdx = chart.panes().length;
        macdLineRef.current   = chart.addSeries(LineSeries,      { ...lineOpts, color: "#22c55e", lineWidth: 2 }, paneIdx);
        macdSignalRef.current = chart.addSeries(LineSeries,      { ...lineOpts, color: "#ef4444", lineWidth: 1, lastValueVisible: false }, paneIdx);
        macdHistRef.current   = chart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false }, paneIdx);
        macdPaneRef.current   = chart.panes()[paneIdx];
        macdLineRef.current.createPriceLine({ price: 0, color: "#64748b", lineWidth: 1, lineStyle: 0, axisLabelVisible: true, title: "0" });
      }
      macdLineRef.current.setData(m.macd);
      macdSignalRef.current!.setData(m.signal);
      macdHistRef.current!.setData(m.histogram);
      if (m.macd.length > 0) leg.push({ label: `MACD`, value: m.macd[m.macd.length - 1].value.toFixed(4), color: "#22c55e" });
    } else if (macdLineRef.current) {
      chart.removeSeries(macdLineRef.current);    macdLineRef.current   = null;
      chart.removeSeries(macdSignalRef.current!); macdSignalRef.current = null;
      chart.removeSeries(macdHistRef.current!);   macdHistRef.current   = null;
      if (macdPaneRef.current) {
        const idx = chart.panes().indexOf(macdPaneRef.current);
        if (idx > 0) try { chart.removePane(idx); } catch {}
        macdPaneRef.current = null;
      }
    }

    // ── Stochastic (new pane) with 80/20 reference lines ──
    if (cfg.stoch.enabled) {
      const stoch = calcStochastic(data, cfg.stoch.kPeriod, cfg.stoch.dPeriod);
      if (!stochKRef.current) {
        const paneIdx = chart.panes().length;
        stochKRef.current  = chart.addSeries(LineSeries, { ...lineOpts, color: "#22d3ee", lineWidth: 2 }, paneIdx);
        stochDRef.current  = chart.addSeries(LineSeries, { ...lineOpts, color: "#f59e0b", lineWidth: 1, lastValueVisible: false }, paneIdx);
        stochPaneRef.current = chart.panes()[paneIdx];
        stochKRef.current.createPriceLine({ price: 80, color: "#ef444470", lineWidth: 1, lineStyle: 2, axisLabelVisible: true,  title: "80" });
        stochKRef.current.createPriceLine({ price: 20, color: "#22c55e70", lineWidth: 1, lineStyle: 2, axisLabelVisible: true,  title: "20" });
      }
      stochKRef.current.setData(stoch.k);
      stochDRef.current!.setData(stoch.d);
      if (stoch.k.length > 0) {
        const kVal = stoch.k[stoch.k.length - 1].value;
        const dVal = stoch.d.length > 0 ? stoch.d[stoch.d.length - 1].value : null;
        leg.push({ label: `Stoch K`, value: kVal.toFixed(1), color: "#22d3ee" });
        if (dVal !== null) leg.push({ label: `D`, value: dVal.toFixed(1), color: "#f59e0b" });
      }
    } else if (stochKRef.current) {
      chart.removeSeries(stochKRef.current);  stochKRef.current  = null;
      chart.removeSeries(stochDRef.current!); stochDRef.current  = null;
      if (stochPaneRef.current) {
        const idx = chart.panes().indexOf(stochPaneRef.current);
        if (idx > 0) try { chart.removePane(idx); } catch {}
        stochPaneRef.current = null;
      }
    }

    if (visibleRange) try { chart.timeScale().setVisibleRange(visibleRange); } catch {}
    lastLegendRef.current = leg;
    setLegend(leg);
  }

  // Keep recalcRef pointing at a closure that always has the latest indicators.
  // This lets WS callbacks (captured once in [] effects) call recalcRef.current().
  useEffect(() => {
    recalcRef.current = () => runRecalc(indicators);
    // Also trigger immediately so toggling an indicator takes effect right away
    recalcRef.current();
  }, [indicators]); // eslint-disable-line react-hooks/exhaustive-deps


  // ── Payout map (polls every 30s so admin changes appear quickly) ─────────
  useEffect(() => {
    if (status !== "authenticated") return;
    function fetchPayout() {
      fetch("/api/payout")
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.payout) setPayoutMap(d.payout); })
        .catch(() => {});
    }
    fetchPayout();
    const id = setInterval(fetchPayout, 30_000);
    return () => clearInterval(id);
  }, [status]);

  // ── Auth guard + balance ─────────────────────────────────────────────────
  const fetchBalance = useCallback(async () => {
    const res = await fetch("/api/balance");
    if (res.ok) {
      const d = await res.json();
      setBalance(d.balance); setDemoBalance(d.demoBalance); setIsDemo(d.isDemo);
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated")   fetchBalance();
  }, [status, router, fetchBalance]);

  // ── Deriv WebSocket — connect once, register handlers ───────────────────
  useEffect(() => {
    derivWS.connect();

    const unsubTick = derivWS.onTick((tick) => {
      // Update ticker for all pairs
      setTickerPrices(prev => ({ ...prev, [tick.symbol]: tick.quote }));

      // Only update chart/price display for the selected pair
      if (tick.symbol !== selectedPairRef.current?.symbol) return;

      const q = tick.quote;
      const up = q >= lastPriceRef.current;
      setPriceUp(up);
      lastPriceRef.current = q;
      setCurrentPrice(q);
      if (livePriceLineRef.current) {
        livePriceLineRef.current.applyOptions({
          price: q,
          color: up ? "#22c55e" : "#ef4444",
        });
      }
      setSentiment(Math.floor(45 + Math.random() * 30));

      // Skip candle updates during reconnect window — fresh history will arrive via onCandles
      if (reconnectingRef.current) return;

      // Sanity check: ignore ticks that deviate > 8% from last known price (bad tick)
      if (lastPriceRef.current > 0 && Math.abs(q - lastPriceRef.current) / lastPriceRef.current > 0.08) return;

      // Update live candle
      if (!candleSeriesRef.current) return;
      const gran = GRANULARITY[timeframeRef.current] ?? 60;
      const candleTime = (Math.floor(tick.epoch / gran) * gran) as Time;
      const c = currentCandleRef.current;

      if (!c || (c.time as number) < (candleTime as number)) {
        currentCandleEpochRef.current = candleTime as number;
        const newC: CandlestickData = { time: candleTime, open: q, high: q, low: q, close: q };
        currentCandleRef.current = newC;
        candleSeriesRef.current.update(newC);
        // Append new candle and recalc indicators on candle open
        candleDataRef.current = [...candleDataRef.current, newC];
        recalcRef.current();
      } else {
        const updated: CandlestickData = {
          ...c, high: Math.max(c.high, q), low: Math.min(c.low, q), close: q,
        };
        currentCandleRef.current = updated;
        candleSeriesRef.current.update(updated);
        // Keep last data point in sync (no recalc on every tick — only on candle open)
        const d = candleDataRef.current;
        if (d.length > 0) d[d.length - 1] = updated;
      }
    });

    // On reconnect, re-request fresh candle history so any spike from the
    // offline gap is replaced by real server data within 1-2 seconds.
    const unsubConnect = derivWS.onConnect(() => {
      reconnectingRef.current = true;        // block tick → candle updates until fresh data arrives
      currentCandleRef.current = null;       // discard stale candle from before disconnect
      const pair = selectedPairRef.current;
      if (!pair) return;
      derivWS.getCandles(pair.symbol, GRANULARITY[timeframeRef.current] ?? 60, 300);
    });

    const unsubCandles = derivWS.onCandles((symbol, raw) => {
      // Ignore stale responses from a previously selected pair
      if (symbol !== selectedPairRef.current?.symbol) return;
      if (!candleSeriesRef.current) return;

      const candles = toChartCandles(raw);
      if (candles.length === 0) return;

      candleSeriesRef.current.setData(candles);
      candleDataRef.current = candles;
      recalcRef.current();
      currentCandleRef.current = candles[candles.length - 1];
      reconnectingRef.current = false;       // fresh data arrived — allow tick updates again
      chartApiRef.current?.timeScale().scrollToRealTime();

      // Seed price display from last candle if no tick yet
      const last = candles[candles.length - 1].close;
      if (lastPriceRef.current === 0) {
        lastPriceRef.current = last;
        setCurrentPrice(last);
      }
    });

    return () => {
      unsubTick();
      unsubCandles();
      unsubConnect();
      derivWS.unsubscribeAll();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Subscribe to ticks + request candles when pair or timeframe changes ──
  useEffect(() => {
    if (!selectedPair) return;
    const gran = GRANULARITY[timeframe] ?? 60;

    // Reset sync refs so the timer re-anchors to the first real tick of this pair/timeframe
    currentCandleEpochRef.current = 0;

    // Clear stale candles so no fake spike appears before real data arrives
    if (candleSeriesRef.current) {
      candleSeriesRef.current.setData([]);
    }
    currentCandleRef.current = null;

    lastPriceRef.current = 0;
    derivWS.subscribeToTicks(pairs.map(p => p.symbol));
    derivWS.getCandles(selectedPair.symbol, gran, 300);
  }, [selectedPair, timeframe, pairs]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Real wins feed (polls every 15s) ─────────────────────────────────────
  useEffect(() => {
    function fetchWins() {
      fetch("/api/recent-wins")
        .then(r => r.ok ? r.json() : [])
        .then((d: any[]) => setRecentWins(d.slice(0, 8).map(w => ({ name: w.name, amount: w.amount, time: new Date(w.time).getTime() }))));
    }
    fetchWins();
    const id = setInterval(fetchWins, 15_000);
    return () => clearInterval(id);
  }, []);

  // ── Chart init / reinit ─────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedPair) return;
    if (isMobile && windowHeight === 0) return;

    const TOPBAR_H     = 52;
    const TICKER_H     = 28;
    const TF_H         = 38;
    const TRADEPANEL_H = 162;
    const chartHeight  = isMobile
      ? windowHeight - TOPBAR_H - TICKER_H - TF_H - TRADEPANEL_H
      : (chartRef.current?.clientHeight || 500);

    function initChart() {
      const el = chartRef.current;
      if (!el) return;
      if (chartApiRef.current) { chartApiRef.current.remove(); chartApiRef.current = null; }

      const w = el.clientWidth || window.innerWidth;
      const h = chartHeight;
      if (w === 0 || h === 0) return;

      const chart = createChart(el, {
        layout: { background: { color: "#0a0f1e" }, textColor: "#94a3b8", attributionLogo: false },
        grid:   { vertLines: { color: "#1e2d50" }, horzLines: { color: "#1e2d50" } },
        crosshair:       { mode: 1 },
        rightPriceScale: {
          borderColor: "#1e2d50",
          autoScale:   true,
          scaleMargins: { top: 0.1, bottom: 0.1 },
        },
        timeScale: {
          borderColor: "#1e2d50", timeVisible: true,
          rightOffset: 8,
          barSpacing: 6,
          fixLeftEdge: false,
          lockVisibleTimeRangeOnResize: false,
          shiftVisibleRangeOnNewBar: true,
        },
        width: w, height: h,
      });
      chartApiRef.current = chart;

      chart.subscribeCrosshairMove((param) => {
        const cfg = indicatorsRef.current;
        if (!param.time) { setLegend(lastLegendRef.current); return; }
        const dec = selectedPairRef.current?.decimals ?? 5;
        const leg: { label: string; value: string; color: string }[] = [];

        if (cfg.ma.enabled) {
          cfg.ma.periods.forEach(p => {
            const s = maSeriesRefs.current.get(p);
            const d = s ? (param.seriesData.get(s) as { value?: number } | undefined) : undefined;
            if (d?.value !== undefined) leg.push({ label: `MA ${p}`, value: d.value.toFixed(dec), color: MA_COLORS[p] ?? "#f5a623" });
          });
        }
        if (cfg.ema.enabled) {
          cfg.ema.periods.forEach(p => {
            const s = emaSeriesRefs.current.get(p);
            const d = s ? (param.seriesData.get(s) as { value?: number } | undefined) : undefined;
            if (d?.value !== undefined) leg.push({ label: `EMA ${p}`, value: d.value.toFixed(dec), color: EMA_COLORS[p] ?? "#a78bfa" });
          });
        }
        if (cfg.bb.enabled) {
          const u = bbUpperRef.current  ? (param.seriesData.get(bbUpperRef.current)  as { value?: number } | undefined) : undefined;
          const l = bbLowerRef.current  ? (param.seriesData.get(bbLowerRef.current)  as { value?: number } | undefined) : undefined;
          if (u?.value !== undefined) leg.push({ label: `BB↑`, value: u.value.toFixed(dec), color: "#38bdf8" });
          if (l?.value !== undefined) leg.push({ label: `BB↓`, value: l.value.toFixed(dec), color: "#38bdf880" });
        }
        if (cfg.rsi.enabled && rsiSeriesRef.current) {
          const d = param.seriesData.get(rsiSeriesRef.current) as { value?: number } | undefined;
          if (d?.value !== undefined) leg.push({ label: `RSI ${cfg.rsi.period}`, value: d.value.toFixed(1), color: "#f97316" });
        }
        if (cfg.macd.enabled) {
          const ml = macdLineRef.current   ? (param.seriesData.get(macdLineRef.current)   as { value?: number } | undefined) : undefined;
          const ms = macdSignalRef.current ? (param.seriesData.get(macdSignalRef.current) as { value?: number } | undefined) : undefined;
          if (ml?.value !== undefined) leg.push({ label: `MACD`, value: ml.value.toFixed(4), color: "#22c55e" });
          if (ms?.value !== undefined) leg.push({ label: `Sig`,  value: ms.value.toFixed(4), color: "#ef4444" });
        }
        if (cfg.stoch.enabled) {
          const k = stochKRef.current ? (param.seriesData.get(stochKRef.current) as { value?: number } | undefined) : undefined;
          const d = stochDRef.current ? (param.seriesData.get(stochDRef.current) as { value?: number } | undefined) : undefined;
          if (k?.value !== undefined) leg.push({ label: `Stoch K`, value: k.value.toFixed(1), color: "#22d3ee" });
          if (d?.value !== undefined) leg.push({ label: `D`,       value: d.value.toFixed(1), color: "#f59e0b" });
        }

        if (leg.length) setLegend(leg);
      });

      const dec = selectedPair?.decimals ?? 5;
      const series = chart.addSeries(CandlestickSeries, {
        upColor:       "#22c55e", downColor:       "#ef4444",
        borderUpColor: "#22c55e", borderDownColor: "#ef4444",
        wickUpColor:   "#22c55e", wickDownColor:   "#ef4444",
        lastValueVisible: false,
        priceFormat: { type: "price", precision: dec, minMove: Math.pow(10, -dec) },
      });
      candleSeriesRef.current  = series;
      currentCandleRef.current = null;
      tradePriceLinesRef.current.clear();
      livePriceLineRef.current = series.createPriceLine({
        price: SEED_PRICES[selectedPair?.symbol ?? ""] ?? 1,
        color: "#22c55e",
        lineWidth: 1,
        lineStyle: 0,
        axisLabelVisible: true,
        title: "",
      });
      // Null indicator refs — chart.remove() invalidated them
      maSeriesRefs.current.clear(); emaSeriesRefs.current.clear();
      bbUpperRef.current  = null; bbMiddleRef.current  = null; bbLowerRef.current = null;
      rsiSeriesRef.current = null;  rsiPaneRef.current  = null;
      macdLineRef.current = null; macdSignalRef.current = null; macdHistRef.current = null; macdPaneRef.current = null;
      stochKRef.current = null; stochDRef.current = null; stochPaneRef.current = null;

      // Start with empty chart — real candles arrive via WS within ~1 second
      series.setData([]);
      currentCandleRef.current = null;

      const ro = new ResizeObserver(() => {
        if (el && chartApiRef.current) chartApiRef.current.applyOptions({ width: el.clientWidth });
      });
      ro.observe(el);
      (chartApiRef as any)._roDisconnect = () => ro.disconnect();
    }

    const timer = isMobile ? setTimeout(initChart, 150) : (initChart(), undefined);

    return () => {
      clearTimeout(timer);
      if ((chartApiRef as any)._roDisconnect) {
        (chartApiRef as any)._roDisconnect();
        delete (chartApiRef as any)._roDisconnect;
      }
    };
  }, [selectedPair, isMobile, windowHeight]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Poll active trades / notify result ───────────────────────────────────
  useEffect(() => {
    if (status !== "authenticated") return;
    async function poll() {
      const sentAt = Date.now();
      const res = await fetch("/api/trade");
      if (!res.ok) return;
      const data = await res.json();
      const trades: any[] = (data.trades ?? []).map((t: any) => ({
        ...t,
        expiresAt: typeof t.expiresAt === "number" ? t.expiresAt : 0,
      }));
      setActiveTrades(trades.filter((t: any) => t.status === "active"));
      const justClosed = trades.filter((t: any) => {
        if (t.status !== "closed") return false;
        return Date.now() - new Date(t.closedAt).getTime() < 6000;
      });
      // Só notifica trades abertos nesta sessão — trades antigos fecham silenciosamente
      const unnotified = justClosed.find(t =>
        !notifiedTradesRef.current.has(t.id) && sessionTradeIdsRef.current.has(t.id)
      );
      if (unnotified) {
        notifiedTradesRef.current.add(unnotified.id);
        const isDraw = unnotified.result === "draw";
        const isWin  = unnotified.result === "win";
        setNotification({
          msg:  isWin  ? `Ganhou +${formatKz(Math.round(unnotified.profit))}`
              : isDraw ? `Empate — aposta devolvida`
              :          `Perdeu ${formatKz(unnotified.amount)}`,
          type: isWin ? "win" : isDraw ? "info" : "loss",
        });
        setTimeout(() => setNotification(null), 4000);
        fetchBalance();
      }
    }
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, [status, fetchBalance]);

  // ── Linhas de entrada dos trades + sync activeTradesRef ──────────────────
  useEffect(() => {
    activeTradesRef.current = activeTrades;
    if (!candleSeriesRef.current) return;
    const activeIds = new Set(activeTrades.map(t => t.id));
    tradePriceLinesRef.current.forEach((line, id) => {
      if (!activeIds.has(id)) {
        try { candleSeriesRef.current?.removePriceLine(line); } catch {}
        tradePriceLinesRef.current.delete(id);
      }
    });
    activeTrades.filter(t => t.asset === selectedPair?.label).forEach(t => {
      const win   = t.direction === "call" ? lastPriceRef.current > t.entryPrice : lastPriceRef.current < t.entryPrice;
      const color = win ? "#22c55e" : "#ef4444";
      const title = `${t.direction === "call" ? "▲" : "▼"} ${formatKz(t.amount)}`;
      if (tradePriceLinesRef.current.has(t.id)) {
        tradePriceLinesRef.current.get(t.id).applyOptions({ color, title });
      } else if (candleSeriesRef.current) {
        const line = candleSeriesRef.current.createPriceLine({
          price: t.entryPrice, color, lineWidth: 1, lineStyle: 2,
          axisLabelVisible: false, title,
        });
        tradePriceLinesRef.current.set(t.id, line);
      }
    });
  }, [activeTrades, selectedPair]); // eslint-disable-line react-hooks/exhaustive-deps

  // Actualiza cor da linha de entrada a cada tick de preço
  useEffect(() => {
    tradePriceLinesRef.current.forEach((line, id) => {
      const trade = activeTradesRef.current.find(t => t.id === id);
      if (!trade) return;
      const win = trade.direction === "call" ? currentPrice > trade.entryPrice : currentPrice < trade.entryPrice;
      line.applyOptions({ color: win ? "#22c55e" : "#ef4444" });
    });
  }, [currentPrice]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  function isTradeWinning(direction: string, entryPrice: number): boolean {
    if (currentPrice === 0 || entryPrice === 0) return false;
    return direction === "call" ? currentPrice > entryPrice : currentPrice < entryPrice;
  }


  async function fetchTradeHistory() {
    try {
      const res = await fetch("/api/trade?limit=30");
      if (!res.ok) return;
      const data = await res.json();
      setTradeHistory((data.trades ?? []).filter((t: any) => t.status !== "active"));
    } catch {}
  }

  function getCountdown(trade: ActiveTrade) {
    const remMs = trade.expiresAt - Date.now();
    if (remMs <= 0) return "A fechar...";
    const rem = Math.ceil(remMs / 1000);
    return `${Math.floor(rem / 60)}:${String(rem % 60).padStart(2, "0")}`;
  }

  // ── Fechar um trade — tenta o servidor com backoff, notifica só trades desta sessão ──
  const triggerClose = useCallback(async (tradeId: string) => {
    if (closingTradesRef.current.has(tradeId)) return;

    const attempts = closeAttemptsRef.current.get(tradeId) ?? 0;
    if (attempts >= 8) return; // poll de 3s apanha o resultado depois disso

    closingTradesRef.current.add(tradeId);
    try {
      // Envia o preço actual como fallback — o servidor usa o seu próprio preço se conseguir
      const exitPrice = lastPriceRef.current > 0 ? lastPriceRef.current : undefined;
      const res = await fetch(`/api/trade/${tradeId}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exitPrice }),
      });
      if (!res.ok) {
        closeAttemptsRef.current.set(tradeId, attempts + 1);
        closingTradesRef.current.delete(tradeId);
        // Reagenda com backoff exponencial (1s, 2s, 4s, 8s, 16s, 32s, 64s, 128s)
        const delay = Math.min(128, Math.pow(2, attempts)) * 1000;
        tradeTimersRef.current.set(
          tradeId,
          setTimeout(() => { tradeTimersRef.current.delete(tradeId); triggerClose(tradeId); }, delay),
        );
        return;
      }
      closeAttemptsRef.current.delete(tradeId);
      // Cancela qualquer timer pendente para este trade
      const pending = tradeTimersRef.current.get(tradeId);
      if (pending !== undefined) { clearTimeout(pending); tradeTimersRef.current.delete(tradeId); }

      const data = await res.json();
      setActiveTrades(prev => prev.filter(t => t.id !== tradeId));
      const t = data.trade;
      // Só notifica trades desta sessão — trades antigos fecham silenciosamente
      if (t?.status === "closed" && !notifiedTradesRef.current.has(t.id) && sessionTradeIdsRef.current.has(tradeId)) {
        notifiedTradesRef.current.add(t.id);
        const isDraw = t.result === "draw";
        const isWin  = t.result === "win";
        setNotification({
          msg:  isWin  ? `Ganhou +${formatKz(Math.round(t.profit ?? 0))}`
              : isDraw ? `Empate — aposta devolvida`
              :          `Perdeu ${formatKz(t.amount)}`,
          type: isWin ? "win" : isDraw ? "info" : "loss",
        });
        setTimeout(() => setNotification(null), 4000);
        fetchBalance();
      } else if (t?.status === "closed") {
        fetchBalance(); // trade antigo — actualiza saldo silenciosamente
      }
    } catch {
      closeAttemptsRef.current.set(tradeId, attempts + 1);
      closingTradesRef.current.delete(tradeId);
    }
  }, [fetchBalance]);

  // ── setInterval: atualiza countdown e fecha trades quando expiram ──
  useEffect(() => {
    const id = setInterval(() => {
      setTick(t => t + 1); // força re-render do countdown
      const now = Date.now();
      activeTradesRef.current.forEach(trade => {
        if (now < trade.expiresAt) return;
        const attempts = closeAttemptsRef.current.get(trade.id) ?? 0;
        const delay  = Math.min(16, Math.pow(2, attempts)) * 1000;
        const lastAt = closeLastAtRef.current.get(trade.id) ?? 0;
        if (Date.now() - lastAt < delay) return;
        closeLastAtRef.current.set(trade.id, Date.now());
        triggerClose(trade.id);
      });
    }, 1000);
    return () => clearInterval(id);
  }, [triggerClose]);

  // Limpa timers pendentes ao desmontar
  useEffect(() => {
    return () => { tradeTimersRef.current.forEach(clearTimeout); };
  }, []);

  async function openTrade(direction: "call" | "put") {
    if (loading || !selectedPair) return;
    setLoading(true);
    const started = Date.now();
    try {
      const res = await fetch("/api/trade", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asset:      selectedPair.label,
          direction,
          amount,
          expirySecs: expiry.secs,
          entryPrice: currentPrice || SEED_PRICES[selectedPair.symbol] || 1,
        }),
      });
      const receivedAt = Date.now();
      const data = await res.json();
      if (!res.ok) {
        setNotification({ msg: data.error, type: "info" });
      } else {
        setNotification({
          msg: `Operação aberta — ${direction === "call" ? "ALTA" : "BAIXA"} ${selectedPair.label}`,
          type: "info",
        });
        if (isMobile) setTradeDrawer(false);
        fetchBalance();
        if (data.trade) {
          // Regista como trade desta sessão (para notificação win/loss)
          sessionTradeIdsRef.current.add(data.trade.id);

          setActiveTrades(prev => {
            if (prev.some((t: any) => t.id === data.trade.id)) return prev;
            return [...prev, { ...data.trade }];
          });
        }
      }
    } catch (err: any) {
      console.error("[openTrade]", err);
      setNotification({ msg: `Erro: ${err?.message ?? "ligação falhou"}`, type: "info" });
    }
    // Enforce minimum 2s to prevent accidental double-submit
    const elapsed = Date.now() - started;
    if (elapsed < 2000) await new Promise(r => setTimeout(r, 2000 - elapsed));
    setTimeout(() => setNotification(null), 3000);
    setLoading(false);
  }

  async function resetDemo() {
    setDemoReloading(true);
    try {
      const res = await fetch("/api/demo/reset", { method: "POST" });
      if (res.ok) { const d = await res.json(); setDemoBalance(d.demoBalance); }
    } catch { /* silent */ }
    setDemoReloading(false);
  }

  async function toggleAccount() {
    const res = await fetch("/api/balance", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDemo: !isDemo }),
    });
    if (res.ok) { const d = await res.json(); setIsDemo(d.isDemo); }
  }

  const displayBalance = isDemo ? demoBalance : balance;
  const currentPayout  = selectedPair ? (payoutMap[selectedPair.label] ?? 0.85) : 0.85;
  const profit         = amount * currentPayout;
  const decimals       = selectedPair?.decimals ?? 5;
  const priceStr       = currentPrice > 0 ? currentPrice.toFixed(decimals) : "—";

  // ── Shared trade panel ────────────────────────────────────────────────────
  function renderTradePanel(compact = false) { return (
    <div style={{ display: "flex", flexDirection: "column", gap: compact ? 10 : 12 }}>

      {/* ── Live price card ── */}
      <div style={{
        background: "linear-gradient(135deg,#0d1526 0%,#111827 100%)",
        border: `1px solid ${priceUp ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
        borderRadius: 12, padding: compact ? "12px 14px" : "16px 18px",
        textAlign: "center", position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", inset: 0, background: priceUp ? "radial-gradient(ellipse at 50% 0%,rgba(34,197,94,0.07) 0%,transparent 70%)" : "radial-gradient(ellipse at 50% 0%,rgba(239,68,68,0.07) 0%,transparent 70%)", pointerEvents: "none" }} />
        <div style={{ color: "#64748b", fontSize: 10, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>{selectedPair?.label}</div>
        <div style={{ fontSize: compact ? 24 : 30, fontWeight: 900, color: priceUp ? "#22c55e" : "#ef4444", letterSpacing: 0.5, fontVariantNumeric: "tabular-nums" }}>
          {priceStr}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, marginTop: 4 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: "50%", background: priceUp ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)" }}>
            {priceUp ? <TrendingUp size={10} color="#22c55e" /> : <TrendingDown size={10} color="#ef4444" />}
          </div>
          <span style={{ color: priceUp ? "#22c55e" : "#ef4444", fontSize: 11, fontWeight: 600 }}>
            {currentPrice > 0 ? (priceUp ? "A subir" : "A descer") : "A conectar..."}
          </span>
        </div>
      </div>

      {/* ── Amount ── */}
      <div style={{ background: "#080e1d", border: "1px solid #1e2d50", borderRadius: 12, padding: compact ? 10 : 12 }}>
        <div style={{ color: "#64748b", fontSize: 10, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8 }}>Investimento</div>
        <div style={{ position: "relative", marginBottom: 8 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#f5a623", fontWeight: 800, fontSize: 12, pointerEvents: "none" }}>Kz</span>
          <input type="number" value={amount || ""}
            onChange={e => { const v = parseInt(e.target.value); setAmount(isNaN(v) ? 0 : Math.min(500000, v)); }}
            onBlur={() => setAmount(a => Math.max(1000, a || 1000))}
            placeholder="1.000"
            style={{ width: "100%", background: "#0d1526", border: "1px solid #1e2d50", borderRadius: 8, padding: "11px 12px 11px 36px", color: "#fff", fontSize: 17, fontWeight: 800, outline: "none", boxSizing: "border-box", fontVariantNumeric: "tabular-nums" }} />
        </div>
        <div style={{ display: "flex", gap: 5 }}>
          {QUICK_AMOUNTS.map(q => (
            <button key={q} onClick={() => setAmount(q)} style={{
              flex: 1, height: 32,
              background: amount === q ? "#f5a623" : "#0d1526",
              color: amount === q ? "#0a0f1e" : "#64748b",
              border: `1px solid ${amount === q ? "#f5a623" : "#1e2d50"}`,
              borderRadius: 8, fontSize: 11, fontWeight: 800, cursor: "pointer",
              transition: "all 0.12s",
            }}>{q >= 1000 ? `${q / 1000}k` : q}</button>
          ))}
        </div>
      </div>

      {/* ── Expiry ── */}
      <div style={{ background: "#080e1d", border: "1px solid #1e2d50", borderRadius: 12, padding: compact ? 10 : 12 }}>
        <div style={{ color: "#64748b", fontSize: 10, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8 }}>Expiração</div>
        <div style={{ display: "flex", gap: 5, marginBottom: 8 }}>
          {EXPIRY_OPTIONS.map(opt => (
            <button key={opt.secs} onClick={() => { setExpiry(opt); setCustomMins(String(opt.secs / 60)); }} style={{
              flex: 1, height: 34,
              background: expiry.secs === opt.secs ? "rgba(245,166,35,0.15)" : "#0d1526",
              color: expiry.secs === opt.secs ? "#f5a623" : "#64748b",
              border: `1px solid ${expiry.secs === opt.secs ? "#f5a623" : "#1e2d50"}`,
              borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: "pointer",
              transition: "all 0.12s",
              boxShadow: expiry.secs === opt.secs ? "0 0 8px rgba(245,166,35,0.25)" : "none",
            }}>{opt.label}</button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "#4b5563", fontSize: 10, whiteSpace: "nowrap" }}>Personalizado</span>
          <div style={{ position: "relative", flex: 1 }}>
            <input type="number" min={1} max={59} value={customMins}
              onChange={e => setCustomMins(e.target.value)}
              onBlur={e => {
                const mins = Math.max(1, Math.min(59, parseInt(e.target.value) || 1));
                setCustomMins(String(mins));
                setExpiry({ label: `${mins} min`, secs: mins * 60 });
              }}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  const mins = Math.max(1, Math.min(59, parseInt((e.target as HTMLInputElement).value) || 1));
                  setCustomMins(String(mins));
                  setExpiry({ label: `${mins} min`, secs: mins * 60 });
                  (e.target as HTMLInputElement).blur();
                }
              }}
              style={{ width: "100%", background: "#0d1526", border: "1px solid #1e2d50", borderRadius: 7, padding: "7px 32px 7px 10px", color: "#fff", fontSize: 13, fontWeight: 700, outline: "none", boxSizing: "border-box" }} />
            <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#4b5563", fontSize: 10 }}>min</span>
          </div>
        </div>
      </div>

      {/* ── Payout + BNA ── */}
      <div style={{ background: "linear-gradient(90deg,rgba(245,166,35,0.1) 0%,rgba(245,166,35,0.04) 100%)", border: "1px solid rgba(245,166,35,0.2)", borderRadius: 10, padding: "10px 14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ color: "#64748b", fontSize: 10, fontWeight: 600, letterSpacing: 0.5 }}>RETORNO POTENCIAL</div>
            <div style={{ color: "#f5a623", fontWeight: 900, fontSize: compact ? 15 : 16, marginTop: 2 }}>
              +{formatKz(Math.round(profit))}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "#64748b", fontSize: 10 }}>Payout</div>
            <div style={{ color: "#f5a623", fontWeight: 800, fontSize: 20 }}>{Math.round(currentPayout * 100)}%</div>
          </div>
        </div>
      </div>

      {/* ── Sentiment ── */}
      <div style={{ background: "#080e1d", border: "1px solid #1e2d50", borderRadius: 10, padding: "9px 12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <TrendingUp size={11} color="#22c55e" />
            <span style={{ color: "#22c55e", fontSize: 11, fontWeight: 700 }}>ALTA {sentiment}%</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ color: "#ef4444", fontSize: 11, fontWeight: 700 }}>{100 - sentiment}% BAIXA</span>
            <TrendingDown size={11} color="#ef4444" />
          </div>
        </div>
        <div style={{ height: 6, background: "#0d1526", borderRadius: 3, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${sentiment}%`, background: "linear-gradient(90deg,#22c55e,#f5a623)", transition: "width 0.6s ease", borderRadius: 3 }} />
        </div>
      </div>

      {/* ── CALL / PUT buttons ── */}
      {(() => {
        // Só bloqueia se há um trade DESTA SESSÃO activo — ignora trades antigos da DB
        const sessionActiveTrade = activeTrades.find(t => sessionTradeIdsRef.current.has(t.id));
        const hasActiveTrade = !!sessionActiveTrade;
        const btnDisabled = loading || currentPrice === 0 || hasActiveTrade;
        const activeCountdown = hasActiveTrade ? getCountdown(sessionActiveTrade!) : null;
      return (
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => openTrade("call")} disabled={btnDisabled} style={{
          flex: 1, height: compact ? 52 : 60,
          background: hasActiveTrade ? "linear-gradient(135deg,#0d3320 0%,#14532d 100%)" : "linear-gradient(135deg,#16a34a 0%,#22c55e 100%)",
          color: "#fff", border: "none", borderRadius: 12,
          fontSize: compact ? 14 : 15, fontWeight: 900,
          cursor: btnDisabled ? "not-allowed" : "pointer",
          opacity: btnDisabled ? 0.6 : 1,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
          boxShadow: btnDisabled ? "none" : "0 4px 16px rgba(34,197,94,0.35)",
          transition: "opacity 0.15s, box-shadow 0.15s",
          letterSpacing: 0.5,
        }}>
          {loading ? "..." : hasActiveTrade ? <><TrendingUp size={16} strokeWidth={2.5} /> {activeCountdown}</> : <><TrendingUp size={18} strokeWidth={2.5} /> ALTA</>}
        </button>
        <button onClick={() => openTrade("put")} disabled={btnDisabled} style={{
          flex: 1, height: compact ? 52 : 60,
          background: hasActiveTrade ? "linear-gradient(135deg,#3b0a0a 0%,#7f1d1d 100%)" : "linear-gradient(135deg,#b91c1c 0%,#ef4444 100%)",
          color: "#fff", border: "none", borderRadius: 12,
          fontSize: compact ? 14 : 15, fontWeight: 900,
          cursor: btnDisabled ? "not-allowed" : "pointer",
          opacity: btnDisabled ? 0.6 : 1,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
          boxShadow: btnDisabled ? "none" : "0 4px 16px rgba(239,68,68,0.35)",
          transition: "opacity 0.15s, box-shadow 0.15s",
          letterSpacing: 0.5,
        }}>
          {loading ? "..." : hasActiveTrade ? <><TrendingDown size={16} strokeWidth={2.5} /> {activeCountdown}</> : <><TrendingDown size={18} strokeWidth={2.5} /> BAIXA</>}
        </button>
      </div>
      ); })()}

      {/* ── Active trades ── */}
      {activeTrades.length > 0 && (
        <div style={{ background: "#080e1d", border: "1px solid #1e2d50", borderRadius: 12, padding: compact ? 10 : 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ color: "#64748b", fontSize: 10, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase" }}>Operações ativas</span>
            <span style={{ background: "rgba(245,166,35,0.15)", color: "#f5a623", fontSize: 10, fontWeight: 800, borderRadius: 10, padding: "1px 8px" }}>{activeTrades.length}</span>
          </div>
          {activeTrades.map(t => {
            const winning = isTradeWinning(t.direction, t.entryPrice);
            const cd = getCountdown(t);
            const closing = cd === "A fechar...";
            return (
              <div key={t.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                background: winning ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)",
                border: `1px solid ${winning ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
                borderRadius: 10, padding: "10px 12px", marginBottom: 6,
                transition: "all 0.4s",
              }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>{t.asset}</span>
                    <span style={{
                      background: t.direction === "call" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                      color: t.direction === "call" ? "#22c55e" : "#ef4444",
                      fontSize: 9, fontWeight: 800, borderRadius: 4, padding: "1px 5px",
                    }}>{t.direction === "call" ? "▲ ALTA" : "▼ BAIXA"}</span>
                  </div>
                  <div style={{ color: "#64748b", fontSize: 11 }}>{formatKz(t.amount)}</div>
                  {currentPrice > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: winning ? "#22c55e" : "#ef4444" }} />
                      <span style={{ color: winning ? "#22c55e" : "#ef4444", fontSize: 10, fontWeight: 700 }}>
                        {winning ? "GANHO" : "PERDA"}
                      </span>
                    </div>
                  )}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{
                    color: closing ? "#64748b" : "#f5a623",
                    fontWeight: 800, fontSize: 14,
                    fontVariantNumeric: "tabular-nums",
                    animation: closing ? "pulse 1s ease-in-out infinite" : "none",
                  }}>{cd}</div>
                  <div style={{ color: "#374151", fontSize: 9, marginTop: 1 }}>restante</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Recent wins ── */}
      {recentWins.length > 0 && (
        <div style={{ background: "#080e1d", border: "1px solid #1e2d50", borderRadius: 12, padding: compact ? 10 : 12 }}>
          <div style={{ color: "#64748b", fontSize: 10, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8 }}>Vitórias recentes</div>
          {recentWins.map((w, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: i < recentWins.length - 1 ? "1px solid #0d1526" : "none" }}>
              <span style={{ color: "#94a3b8", fontSize: 12 }}>{w.name}</span>
              <span style={{ color: "#22c55e", fontWeight: 700, fontSize: 12 }}>+{formatKz(w.amount)}</span>
            </div>
          ))}
        </div>
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </div>
  ); }

  // ── Asset dropdown (shared) — render function, NOT a JSX component, so it
  //    never unmounts on re-render (avoids scroll-position reset on price ticks)
  function renderAssetDropdown(mobile = false) {
    const groups: Record<string, DerivPair[]> = {};
    pairs.forEach(p => { (groups[p.category] ??= []).push(p); });
    const catOrder  = ["Forex", "Cripto", "Metal", "Índices"];
    const catColors: Record<string, string> = { Forex: "#f5a623", Cripto: "#a78bfa", Metal: "#fcd34d", Índices: "#22c55e" };
    return (
      <div style={{ position: "relative" }}>
        <button onClick={() => setAssetDropdown(!assetDropdown)}
          style={{ background: "#0a0f1e", border: "1px solid #1e2d50", borderRadius: 8, padding: mobile ? "5px 10px" : "6px 12px", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: mobile ? 4 : 6, fontSize: mobile ? 13 : 14, fontWeight: 700 }}>
          {selectedPair?.label ?? "…"} <ChevronDown size={mobile ? 12 : 14} color="#94a3b8" />
        </button>
        {assetDropdown && (
          <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, background: "#111827", border: "1px solid #1e2d50", borderRadius: 10, minWidth: mobile ? 200 : 240, zIndex: 300, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.5)", maxHeight: mobile ? "70vh" : "420px", overflowY: "auto" }}>
            {catOrder.filter(cat => groups[cat]).map(cat => (
              <div key={cat}>
                <div style={{ padding: "6px 14px 4px", fontSize: 10, fontWeight: 700, color: catColors[cat] ?? "#94a3b8", letterSpacing: 1, textTransform: "uppercase", borderTop: "1px solid #1e2d50" }}>
                  {cat}
                </div>
                {groups[cat].map(p => (
                  <button key={p.symbol}
                    onClick={() => { setSelectedPair(p); setAssetDropdown(false); }}
                    style={{ width: "100%", background: selectedPair?.symbol === p.symbol ? "#1e2d50" : "transparent", border: "none", padding: mobile ? "10px 14px" : "8px 14px", color: "#fff", cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, minHeight: 40 }}>
                    <span style={{ fontWeight: 600 }}>{p.label}</span>
                    {tickerPrices[p.symbol] ? (
                      <span style={{ color: "#94a3b8", fontSize: 11 }}>{tickerPrices[p.symbol].toFixed(p.decimals)}</span>
                    ) : null}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Indicator panel ───────────────────────────────────────────────────────
  function renderIndicatorPanel(compact = false) {
    const maOn    = indicators.ma.enabled;
    const emaOn   = indicators.ema.enabled;
    const bbOn    = indicators.bb.enabled;
    const rsiOn   = indicators.rsi.enabled;
    const macdOn  = indicators.macd.enabled;
    const stochOn = indicators.stoch.enabled;

    const chip = (label: string, color: string, active: boolean, onClick: () => void, sub?: string) => (
      <button onClick={onClick} style={{
        display: "flex", alignItems: "center", gap: 4,
        background: active ? `${color}22` : "transparent",
        color: active ? color : "#64748b",
        border: `1px solid ${active ? color : "#1e2d50"}`,
        borderRadius: 20, padding: compact ? "3px 10px" : "4px 12px",
        fontSize: compact ? 10 : 11, fontWeight: 700, cursor: "pointer",
        boxShadow: active ? `0 0 8px ${color}44` : "none",
        transition: "all 0.15s", whiteSpace: "nowrap",
      }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: active ? color : "#374151", flexShrink: 0 }} />
        {label}
        {sub && active && <span style={{ color: "#64748b", fontSize: 9, fontWeight: 400 }}>{sub}</span>}
      </button>
    );

    const periodPill = (p: number, color: string, active: boolean, onClick: () => void) => (
      <button key={p} onClick={onClick} style={{
        background: active ? color : "#0a0f1e",
        color: active ? "#0a0f1e" : "#94a3b8",
        border: `1px solid ${active ? color : "#1e2d50"}`,
        borderRadius: 12, padding: compact ? "2px 7px" : "3px 8px",
        fontSize: compact ? 9 : 10, fontWeight: 800, cursor: "pointer",
        transition: "all 0.12s",
      }}>{p}</button>
    );

    return (
      <div style={{
        background: "#080e1d",
        borderBottom: "1px solid #1e2d50",
        padding: compact ? "5px 10px" : "6px 14px",
        display: "flex", gap: compact ? 6 : 8, alignItems: "center",
        overflowX: "auto", flexWrap: compact ? "nowrap" : "wrap",
      }}>
        <style>{`.ind-bar::-webkit-scrollbar{display:none}`}</style>

        {/* MA */}
        <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
          {chip("MA", "#f5a623", maOn, () => setIndicators(prev => ({ ...prev, ma: { ...prev.ma, enabled: !prev.ma.enabled } })))}
          {maOn && ([9, 20, 50] as const).map(p => periodPill(p, MA_COLORS[p], indicators.ma.periods.includes(p),
            () => setIndicators(prev => {
              const has = prev.ma.periods.includes(p);
              const periods = has ? prev.ma.periods.filter(x => x !== p) : [...prev.ma.periods, p];
              return { ...prev, ma: { ...prev.ma, periods: periods.length ? periods : [p] } };
            })
          ))}
        </div>

        <div style={{ width: 1, height: 18, background: "#1e2d50", flexShrink: 0 }} />

        {/* EMA */}
        <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
          {chip("EMA", "#a78bfa", emaOn, () => setIndicators(prev => ({ ...prev, ema: { ...prev.ema, enabled: !prev.ema.enabled } })))}
          {emaOn && ([9, 20, 50] as const).map(p => periodPill(p, EMA_COLORS[p], indicators.ema.periods.includes(p),
            () => setIndicators(prev => {
              const has = prev.ema.periods.includes(p);
              const periods = has ? prev.ema.periods.filter(x => x !== p) : [...prev.ema.periods, p];
              return { ...prev, ema: { ...prev.ema, periods: periods.length ? periods : [p] } };
            })
          ))}
        </div>

        <div style={{ width: 1, height: 18, background: "#1e2d50", flexShrink: 0 }} />

        {/* BB */}
        {chip("BB", "#38bdf8", bbOn, () => setIndicators(prev => ({ ...prev, bb: { ...prev.bb, enabled: !prev.bb.enabled } })), bbOn ? `(${indicators.bb.period})` : undefined)}

        {/* RSI */}
        {chip("RSI", "#f97316", rsiOn, () => setIndicators(prev => ({ ...prev, rsi: { ...prev.rsi, enabled: !prev.rsi.enabled } })), rsiOn ? `(${indicators.rsi.period})` : undefined)}

        {/* MACD */}
        {chip("MACD", "#22c55e", macdOn, () => setIndicators(prev => ({ ...prev, macd: { ...prev.macd, enabled: !prev.macd.enabled } })), macdOn ? `${indicators.macd.fast}/${indicators.macd.slow}` : undefined)}

        {/* Stochastic */}
        {chip("Stoch", "#fb923c", stochOn, () => setIndicators(prev => ({ ...prev, stoch: { ...prev.stoch, enabled: !prev.stoch.enabled } })), stochOn ? `${indicators.stoch.kPeriod}/${indicators.stoch.dPeriod}` : undefined)}
      </div>
    );
  }

  function renderLegend() {
    if (!legend.length) return null;
    return (
      <div style={{ position: "absolute", top: 6, left: 6, zIndex: 10, display: "flex", flexDirection: "column", gap: 2, pointerEvents: "none" }}>
        {legend.map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(7,13,28,0.75)", borderRadius: 4, padding: "2px 6px" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: item.color, flexShrink: 0, display: "inline-block" }} />
            <span style={{ color: "#94a3b8", fontSize: 10, fontFamily: "monospace" }}>{item.label}</span>
            <span style={{ color: item.color, fontSize: 10, fontWeight: 700, fontFamily: "monospace" }}>{item.value}</span>
          </div>
        ))}
      </div>
    );
  }

  if (status === "loading" || !selectedPair) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0f1e", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#f5a623", fontSize: 18, fontFamily: "system-ui, sans-serif" }}>A carregar...</div>
      </div>
    );
  }

  // ── MOBILE RENDER ─────────────────────────────────────────────────────────
  if (isMobile) {
    const TOPBAR_H      = 48;
    const TICKER_H      = 26;
    const TF_H          = 36;
    const TRADEPANEL_H  = 162;
    const OPSPANEL_H    = 230;
    const CONTENT_TOP   = TOPBAR_H + TICKER_H + TF_H;
    const chartTop      = CONTENT_TOP;
    const chartH        = windowHeight > 0 ? windowHeight - CONTENT_TOP - TRADEPANEL_H : 400;

    return (
      <div style={{ height: "100vh", background: "#0a0f1e", fontFamily: "system-ui, -apple-system, sans-serif", overflow: "hidden" }}>

        {/* Win/loss toast — below all fixed bars */}
        {notification && (
          <div style={{ position: "fixed", top: CONTENT_TOP + 8, left: 12, right: 12, zIndex: 2000, background: notification.type === "win" ? "rgba(34,197,94,0.96)" : notification.type === "loss" ? "rgba(239,68,68,0.96)" : "rgba(245,166,35,0.96)", color: "#fff", padding: "12px 16px", borderRadius: 10, fontWeight: 700, fontSize: 14, boxShadow: "0 4px 20px rgba(0,0,0,0.5)", display: "flex", alignItems: "center", gap: 8 }}>
            {notification.type === "win" ? <TrendingUp size={16} /> : notification.type === "loss" ? <TrendingDown size={16} /> : <AlertCircle size={16} />}
            {notification.msg}
          </div>
        )}

        {/* ── Topbar ── */}
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: TOPBAR_H, zIndex: 110, background: "#080e1d", borderBottom: "1px solid #1a2540", display: "flex", alignItems: "center", padding: "0 10px", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <div style={{ width: 24, height: 24, background: "linear-gradient(135deg,#f5a623,#e8940f)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 10px rgba(245,166,35,0.35)" }}>
              <TrendingUp size={12} color="#0a0f1e" strokeWidth={2.5} />
            </div>
            <span style={{ color: "#fff", fontWeight: 900, fontSize: 13, letterSpacing: 0.2 }}>Dynamics</span>
          </div>

          {renderAssetDropdown(true)}
          <div style={{ flex: 1 }} />

          {isDemo && demoBalance < 5000 && (
            <button onClick={resetDemo} disabled={demoReloading}
              style={{ background: "transparent", border: "1px solid #f5a623", color: "#f5a623", borderRadius: 5, fontSize: 10, padding: "2px 6px", cursor: demoReloading ? "not-allowed" : "pointer", opacity: demoReloading ? 0.6 : 1, flexShrink: 0 }}>
              {demoReloading ? "..." : "↺"}
            </button>
          )}

          <NotificationBell />

          {/* Ranking / Torneios — quick access */}
          <a href="/ranking" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.2)", borderRadius: 7, flexShrink: 0 }}>
            <Trophy size={14} color="#f5a623" />
          </a>

          <button onClick={toggleAccount} style={{ background: isDemo ? "rgba(245,166,35,0.1)" : "rgba(34,197,94,0.1)", border: `1px solid ${isDemo ? "rgba(245,166,35,0.3)" : "rgba(34,197,94,0.3)"}`, borderRadius: 8, padding: "4px 9px", display: "flex", alignItems: "center", gap: 5, cursor: "pointer", flexShrink: 0 }}>
            <Wallet size={11} color={isDemo ? "#f5a623" : "#22c55e"} />
            <span style={{ color: "#fff", fontWeight: 800, fontSize: 11, fontVariantNumeric: "tabular-nums" }}>{formatKz(Math.floor(displayBalance))}</span>
            <span style={{ background: isDemo ? "#f5a623" : "#22c55e", color: "#0a0f1e", borderRadius: 3, fontSize: 8, padding: "1px 4px", fontWeight: 900 }}>{isDemo ? "D" : "R"}</span>
          </button>

          <div style={{ position: "relative", flexShrink: 0 }}>
            <button onClick={() => setUserMenuOpen(!userMenuOpen)}
              style={{ width: 26, height: 26, background: "linear-gradient(135deg,#f5a623,#e8940f)", borderRadius: "50%", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 8px rgba(245,166,35,0.3)" }}>
              <User size={13} color="#0a0f1e" />
            </button>
            {userMenuOpen && (
              <div style={{ position: "absolute", top: "110%", right: 0, background: "#111827", border: "1px solid #1e2d50", borderRadius: 12, minWidth: 172, zIndex: 500, boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>
                <div style={{ padding: "12px 14px", borderBottom: "1px solid #1e2d50" }}>
                  <div style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>{session?.user?.name}</div>
                  <div style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>{session?.user?.email}</div>
                </div>
                {[
                  { href: "/profile",   icon: <User size={13} />,     label: "Perfil"     },
                  { href: "/dashboard", icon: <BarChart2 size={13} />, label: "Dashboard"  },
                  { href: "/ranking",   icon: <Trophy size={13} />,    label: "Ranking & Torneios" },
                  { href: "/history",   icon: <History size={13} />,   label: "Histórico"  },
                  { href: "/wallet",    icon: <Wallet size={13} />,    label: "Carteira"   },
                ].map(({ href, icon, label }) => (
                  <a key={href} href={href} onClick={() => setUserMenuOpen(false)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", color: "#94a3b8", textDecoration: "none", fontSize: 13 }}>{icon}{label}</a>
                ))}
                <button onClick={() => signOut({ callbackUrl: "/login" })}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", color: "#ef4444", background: "none", border: "none", cursor: "pointer", fontSize: 13 }}>
                  <LogOut size={13} /> Sair
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Ticker bar ── */}
        <div style={{ position: "fixed", top: TOPBAR_H, left: 0, right: 0, height: TICKER_H, zIndex: 109, background: "#060c1a", borderBottom: "1px solid #1a2540", overflow: "hidden", display: "flex", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 20, padding: "0 12px", animation: "ticker 24s linear infinite", whiteSpace: "nowrap" }}>
            {[...pairs, ...pairs].map((p, i) => {
              const price = tickerPrices[p.symbol] ?? 0;
              const seed  = SEED_PRICES[p.symbol] ?? 1;
              const isUp  = price >= seed;
              const pct   = seed > 0 && price > 0 ? ((price - seed) / seed * 100) : 0;
              return (
                <span key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ color: "#64748b", fontWeight: 600, fontSize: 10 }}>{p.label}</span>
                  <span style={{ color: isUp ? "#22c55e" : "#ef4444", fontWeight: 700, fontSize: 10, fontVariantNumeric: "tabular-nums" }}>
                    {price > 0 ? price.toFixed(p.decimals) : "—"}
                  </span>
                  {price > 0 && (
                    <span style={{ color: isUp ? "#22c55e" : "#ef4444", fontSize: 9, opacity: 0.7 }}>
                      {isUp ? "▲" : "▼"}{Math.abs(pct).toFixed(2)}%
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        </div>

        {/* ── Timeframe strip ── */}
        <div style={{ position: "fixed", top: TOPBAR_H + TICKER_H, left: 0, right: 0, height: TF_H, zIndex: 108, background: "#080e1d", borderBottom: "1px solid #1a2540", display: "flex", alignItems: "center", padding: "0 10px", gap: 5 }}>
          {["1m", "5m", "15m", "1h", "1D"].map(tf => (
            <button key={tf} onClick={() => setTimeframe(tf)} style={{ height: 24, padding: "0 9px", background: timeframe === tf ? "#f5a623" : "transparent", color: timeframe === tf ? "#0a0f1e" : "#64748b", border: `1px solid ${timeframe === tf ? "#f5a623" : "#1e2d50"}`, borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              {tf}
            </button>
          ))}
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
            {candleTimer && <span style={{ fontSize: 11, fontWeight: 700, color: "#4b5563", fontVariantNumeric: "tabular-nums" }}>{candleTimer}</span>}
            <button onClick={() => setShowIndicators(v => !v)} style={{ height: 24, padding: "0 8px", background: showIndicators ? "rgba(245,166,35,0.12)" : "transparent", color: showIndicators ? "#f5a623" : "#4b5563", border: `1px solid ${showIndicators ? "rgba(245,166,35,0.4)" : "#1e2d50"}`, borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
              IND
            </button>
          </div>
        </div>

        {/* ── Indicator panel (mobile overlay) ── */}
        {showIndicators && (
          <div style={{ position: "fixed", top: TOPBAR_H + TICKER_H + TF_H, left: 0, right: 0, zIndex: 107, boxShadow: "0 4px 12px rgba(0,0,0,0.4)" }}>
            {renderIndicatorPanel(true)}
          </div>
        )}

        {/* ── Chart ── */}
        <div style={{ position: "fixed", top: chartTop, left: 0, right: 0, height: chartH, background: "#070d1c", overflow: "hidden" }}>
          <div ref={chartRef} style={{ width: "100%", height: "100%" }} />
          {renderLegend()}
          <div style={{ position: "absolute", inset: 0, zIndex: 2, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            <span style={{ fontSize: 34, fontWeight: 900, color: "rgba(255,255,255,0.08)", letterSpacing: 3, userSelect: "none" }}>{selectedPair?.label}</span>
          </div>

          {/* ── OPS button (top-left of chart) ── */}
          <button onClick={() => { setShowTradesPanel(v => !v); if (!showTradesPanel) { setTradeHistoryTab("open"); fetchTradeHistory(); } }}
            style={{ position: "absolute", top: 8, left: 8, zIndex: 6, background: showTradesPanel ? "rgba(245,166,35,0.15)" : "rgba(8,14,29,0.82)", border: `1px solid ${showTradesPanel ? "#f5a623" : "#1e2d50"}`, borderRadius: 7, padding: "5px 9px", display: "flex", alignItems: "center", gap: 5, cursor: "pointer", backdropFilter: "blur(4px)" }}>
            <BarChart2 size={12} color={showTradesPanel ? "#f5a623" : "#64748b"} />
            <span style={{ color: showTradesPanel ? "#f5a623" : "#94a3b8", fontSize: 11, fontWeight: 700 }}>OPS</span>
            {activeTrades.length > 0 && (
              <span style={{ background: "#f5a623", color: "#0a0f1e", borderRadius: 10, fontSize: 9, fontWeight: 900, padding: "1px 5px" }}>{activeTrades.length}</span>
            )}
          </button>

          {/* ── Zoom controls (bottom centre, over time axis) ── */}
          <div style={{ position: "absolute", bottom: 4, left: "50%", transform: "translateX(-50%)", zIndex: 6, display: "flex", flexDirection: "row", gap: 4 }}>
            <button onClick={() => { const ts = chartApiRef.current?.timeScale(); if (!ts) return; const cur = (ts.options() as any).barSpacing ?? 6; ts.applyOptions({ barSpacing: Math.max(cur - 2, 2) }); }}
              style={{ width: 30, height: 24, background: "rgba(8,14,29,0.88)", border: "1px solid #1e2d50", borderRadius: 5, color: "#94a3b8", fontSize: 16, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>−</button>
            <button onClick={() => { const ts = chartApiRef.current?.timeScale(); if (!ts) return; const cur = (ts.options() as any).barSpacing ?? 6; ts.applyOptions({ barSpacing: Math.min(cur + 2, 30) }); }}
              style={{ width: 30, height: 24, background: "rgba(8,14,29,0.88)", border: "1px solid #1e2d50", borderRadius: 5, color: "#94a3b8", fontSize: 16, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>+</button>
          </div>
        </div>

        {/* ── Trades panel — ABOVE chart ── */}
        {showTradesPanel && (
          <div style={{ position: "fixed", top: CONTENT_TOP, left: 0, right: 0, bottom: TRADEPANEL_H, zIndex: 108, background: "#080e1d", display: "flex", flexDirection: "column" }}>
            {/* Tabs */}
            <div style={{ display: "flex", borderBottom: "1px solid #1e2d50", flexShrink: 0 }}>
              {(["open", "history"] as const).map(tab => (
                <button key={tab} onClick={() => { setTradeHistoryTab(tab); if (tab === "history") fetchTradeHistory(); }}
                  style={{ flex: 1, padding: "9px 0", background: "none", border: "none", borderBottom: `2px solid ${tradeHistoryTab === tab ? "#f5a623" : "transparent"}`, color: tradeHistoryTab === tab ? "#f5a623" : "#64748b", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                  {tab === "open" ? `Em aberto (${activeTrades.length})` : "Histórico"}
                </button>
              ))}
              <button onClick={() => setShowTradesPanel(false)} style={{ padding: "9px 14px", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center" }}>
                <X size={16} color="#64748b" />
              </button>
            </div>
            {/* Content */}
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px" }}>
              {tradeHistoryTab === "open" ? (
                activeTrades.length === 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 8 }}>
                    <BarChart2 size={32} color="#1e2d50" />
                    <span style={{ color: "#64748b", fontSize: 13 }}>Nenhuma operação em aberto</span>
                  </div>
                ) : (
                  activeTrades.map(t => {
                    const rem = t.expiresAt - Date.now();
                    const remSec = Math.max(0, Math.ceil(rem / 1000));
                    const mm = String(Math.floor(remSec / 60)).padStart(2, "0");
                    const ss = String(remSec % 60).padStart(2, "0");
                    const isWinning = t.direction === "call" ? currentPrice > t.entryPrice : currentPrice < t.entryPrice;
                    return (
                      <div key={t.id} style={{ background: "#0d1526", border: `1px solid ${isWinning ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`, borderRadius: 10, padding: "10px 12px", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                            <span style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>{t.asset}</span>
                            <span style={{ background: t.direction === "call" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: t.direction === "call" ? "#22c55e" : "#ef4444", borderRadius: 4, fontSize: 10, fontWeight: 700, padding: "1px 6px" }}>{t.direction === "call" ? "▲ ALTA" : "▼ BAIXA"}</span>
                          </div>
                          <div style={{ color: "#64748b", fontSize: 11 }}>{formatKz(t.amount)} · entrada {t.entryPrice.toFixed(5)}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ color: isWinning ? "#22c55e" : "#ef4444", fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{mm}:{ss}</div>
                          <div style={{ color: "#64748b", fontSize: 10 }}>{isWinning ? "A ganhar" : "A perder"}</div>
                        </div>
                      </div>
                    );
                  })
                )
              ) : (
                tradeHistory.length === 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 8 }}>
                    <History size={32} color="#1e2d50" />
                    <span style={{ color: "#64748b", fontSize: 13 }}>Nenhum histórico ainda</span>
                  </div>
                ) : (
                  tradeHistory.map((t: any) => {
                    const isWin = t.status === "win";
                    const profit = isWin ? Math.round(t.amount * (t.payout ?? 0.74)) : -t.amount;
                    return (
                      <div key={t.id} style={{ background: "#0d1526", border: `1px solid ${isWin ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`, borderRadius: 10, padding: "10px 12px", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                            <span style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>{t.asset}</span>
                            <span style={{ background: t.direction === "call" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: t.direction === "call" ? "#22c55e" : "#ef4444", borderRadius: 4, fontSize: 10, fontWeight: 700, padding: "1px 6px" }}>{t.direction === "call" ? "▲ ALTA" : "▼ BAIXA"}</span>
                            <span style={{ background: isWin ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", color: isWin ? "#22c55e" : "#ef4444", borderRadius: 4, fontSize: 9, fontWeight: 900, padding: "1px 5px" }}>{isWin ? "GANHOU" : "PERDEU"}</span>
                          </div>
                          <div style={{ color: "#64748b", fontSize: 11 }}>{formatKz(t.amount)} · {new Date(t.createdAt).toLocaleTimeString("pt-AO", { hour: "2-digit", minute: "2-digit" })}</div>
                        </div>
                        <div style={{ color: isWin ? "#22c55e" : "#ef4444", fontWeight: 800, fontSize: 14, textAlign: "right" }}>
                          {isWin ? "+" : ""}{formatKz(profit)}
                        </div>
                      </div>
                    );
                  })
                )
              )}
            </div>
          </div>
        )}

        {/* ── Bottom trade panel (always visible, QX Broker style) ── */}
        {(() => {
          const sessionActiveTrade = activeTrades.find(t => sessionTradeIdsRef.current.has(t.id));
          const hasActiveTrade = !!sessionActiveTrade;
          const btnDisabled = loading || currentPrice === 0 || hasActiveTrade;
          const currentPayout = payoutMap[selectedPair?.symbol ?? ""] ?? 0.74;
          const payoutAmt = Math.round(amount * currentPayout);

          // Cronómetro: countdown ao trade activo, ou duração seleccionada em repouso
          let timerDisplay: string;
          let timerColor = "#fff";
          if (hasActiveTrade) {
            const remMs = sessionActiveTrade!.expiresAt - Date.now();
            if (remMs <= 0) {
              timerDisplay = "00:00";
            } else {
              const rem = Math.ceil(remMs / 1000);
              const mm  = String(Math.floor(rem / 60)).padStart(2, "0");
              const ss  = String(rem % 60).padStart(2, "0");
              timerDisplay = `${mm}:${ss}`;
            }
            // vai ficando vermelho conforme o tempo passa
            const pct = hasActiveTrade ? Math.max(0, (sessionActiveTrade!.expiresAt - Date.now()) / (sessionActiveTrade!.expirySecs * 1000)) : 1;
            timerColor = pct < 0.25 ? "#ef4444" : pct < 0.5 ? "#f5a623" : "#22c55e";
          } else {
            const mm = String(Math.floor(expiry.secs / 60)).padStart(2, "0");
            const ss = String(expiry.secs % 60).padStart(2, "0");
            timerDisplay = `${mm}:${ss}`;
          }

          return (
            <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: TRADEPANEL_H, zIndex: 110, background: "#080e1d", borderTop: "1px solid #1a2540", display: "flex", flexDirection: "column", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>

              {/* Row 1 — Asset + % + Pagamento | Expiry pills */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 12px 0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: priceUp ? "#22c55e" : "#ef4444", boxShadow: priceUp ? "0 0 5px #22c55e" : "0 0 5px #ef4444" }} />
                  <span style={{ color: "#fff", fontWeight: 800, fontSize: 12 }}>{selectedPair?.label}</span>
                  <span style={{ background: "rgba(245,166,35,0.15)", color: "#f5a623", fontWeight: 900, fontSize: 11, borderRadius: 4, padding: "1px 5px" }}>{Math.round(currentPayout * 100)}%</span>
                  <span style={{ color: "#334155", fontSize: 10 }}>·</span>
                  <span style={{ color: "#f5a623", fontWeight: 700, fontSize: 11 }}>{formatKz(payoutAmt)}</span>
                </div>
                <div style={{ display: "flex", gap: 3 }}>
                  {EXPIRY_OPTIONS.map(opt => (
                    <button key={opt.secs} onClick={() => setExpiry(opt)} disabled={hasActiveTrade}
                      style={{ height: 22, padding: "0 7px", background: expiry.secs === opt.secs ? "#f5a623" : "#0b1220", color: expiry.secs === opt.secs ? "#0a0f1e" : "#64748b", border: `1px solid ${expiry.secs === opt.secs ? "#f5a623" : "#1a2540"}`, borderRadius: 5, fontSize: 10, fontWeight: 700, cursor: hasActiveTrade ? "not-allowed" : "pointer", opacity: hasActiveTrade ? 0.4 : 1 }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Row 2 — Tempo | Investimento */}
              <div style={{ display: "flex", gap: 8, padding: "6px 12px 0" }}>
                {/* Timer */}
                <div onClick={() => { if (!hasActiveTrade && !timerEditing) { setTimerEditing(true); setTimerInput(String(Math.floor(expiry.secs / 60))); } }}
                  style={{ flex: 1, background: "#0b1220", border: `1px solid ${hasActiveTrade ? timerColor + "55" : timerEditing ? "#f5a623" : "#1a2540"}`, borderRadius: 10, padding: "6px 10px", cursor: hasActiveTrade ? "default" : "pointer", transition: "border-color 0.3s" }}>
                  <div style={{ color: "#334155", fontSize: 9, fontWeight: 600, letterSpacing: 0.8, marginBottom: 1 }}>
                    TEMPO {!hasActiveTrade && !timerEditing && <span style={{ color: "#f5a623" }}>✎</span>}
                  </div>
                  {timerEditing ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 3 }} onClick={e => e.stopPropagation()}>
                      <input autoFocus type="number" min="1" max="60" value={timerInput}
                        onChange={e => setTimerInput(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") { const m = Math.max(1, Math.min(60, parseInt(timerInput)||1)); setExpiry({label:`${m} min`,secs:m*60}); setTimerEditing(false); } if (e.key === "Escape") setTimerEditing(false); }}
                        onBlur={() => { const m = Math.max(1, Math.min(60, parseInt(timerInput)||1)); setExpiry({label:`${m} min`,secs:m*60}); setTimerEditing(false); }}
                        style={{ width: "100%", background: "transparent", border: "none", outline: "none", color: "#f5a623", fontWeight: 900, fontSize: 19, fontVariantNumeric: "tabular-nums" }} />
                      <span style={{ color: "#4b5563", fontSize: 10 }}>min</span>
                    </div>
                  ) : (
                    <div style={{ color: timerColor, fontWeight: 900, fontSize: 19, fontVariantNumeric: "tabular-nums", letterSpacing: 1.5, transition: "color 0.4s" }}>{timerDisplay}</div>
                  )}
                </div>

                {/* Amount */}
                <div onClick={() => { if (!hasActiveTrade && !amountEditing) { setAmountEditing(true); setAmountInput(String(amount)); } }}
                  style={{ flex: 2, background: "#0b1220", border: `1px solid ${amountEditing ? "#f5a623" : "#1a2540"}`, borderRadius: 10, padding: "6px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: hasActiveTrade ? "default" : "pointer", transition: "border-color 0.3s" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: "#334155", fontSize: 9, fontWeight: 600, letterSpacing: 0.8, marginBottom: 1 }}>
                      INVESTIMENTO {!hasActiveTrade && !amountEditing && <span style={{ color: "#f5a623" }}>✎</span>}
                    </div>
                    {amountEditing ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 3 }} onClick={e => e.stopPropagation()}>
                        <input autoFocus type="number" min="1000" max="500000" value={amountInput}
                          onChange={e => setAmountInput(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") { const v = Math.max(1000, Math.min(500000, parseInt(amountInput)||1000)); setAmount(v); setAmountEditing(false); } if (e.key === "Escape") setAmountEditing(false); }}
                          onBlur={() => { const v = Math.max(1000, Math.min(500000, parseInt(amountInput)||1000)); setAmount(v); setAmountEditing(false); }}
                          style={{ width: "100%", background: "transparent", border: "none", outline: "none", color: "#f5a623", fontWeight: 900, fontSize: 15, fontVariantNumeric: "tabular-nums" }} />
                        <span style={{ color: "#4b5563", fontSize: 10, flexShrink: 0 }}>Kz</span>
                      </div>
                    ) : (
                      <div style={{ color: "#fff", fontWeight: 900, fontSize: 15, fontVariantNumeric: "tabular-nums" }}>{formatKz(amount)}</div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 5, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => setAmount(a => Math.max(1000, a - 500))} disabled={hasActiveTrade}
                      style={{ width: 28, height: 28, background: "#1a2540", border: "none", borderRadius: 7, color: "#94a3b8", fontSize: 18, fontWeight: 700, cursor: hasActiveTrade ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: hasActiveTrade ? 0.3 : 1 }}>−</button>
                    <button onClick={() => setAmount(a => a + 500)} disabled={hasActiveTrade}
                      style={{ width: 28, height: 28, background: "#1a2540", border: "none", borderRadius: 7, color: "#94a3b8", fontSize: 18, fontWeight: 700, cursor: hasActiveTrade ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: hasActiveTrade ? 0.3 : 1 }}>+</button>
                  </div>
                </div>
              </div>

              {/* Row 3 — ALTA + BAIXA */}
              <div style={{ display: "flex", gap: 8, padding: "7px 12px 8px", flex: 1 }}>
                <button onClick={() => openTrade("call")} disabled={btnDisabled}
                  style={{ flex: 1, background: hasActiveTrade ? "linear-gradient(150deg,#0a2218,#0f3d22)" : "linear-gradient(150deg,#15803d,#22c55e)", color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 900, cursor: btnDisabled ? "not-allowed" : "pointer", opacity: btnDisabled ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, boxShadow: btnDisabled ? "none" : "0 3px 16px rgba(34,197,94,0.3)", letterSpacing: 0.5 }}>
                  {loading ? "..." : hasActiveTrade ? <><TrendingUp size={14} strokeWidth={2.5} /> {timerDisplay}</> : <><TrendingUp size={17} strokeWidth={2.5} /> ALTA</>}
                </button>
                <button onClick={() => openTrade("put")} disabled={btnDisabled}
                  style={{ flex: 1, background: hasActiveTrade ? "linear-gradient(150deg,#2a0808,#5c1414)" : "linear-gradient(150deg,#b91c1c,#ef4444)", color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 900, cursor: btnDisabled ? "not-allowed" : "pointer", opacity: btnDisabled ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, boxShadow: btnDisabled ? "none" : "0 3px 16px rgba(239,68,68,0.3)", letterSpacing: 0.5 }}>
                  {loading ? "..." : hasActiveTrade ? <><TrendingDown size={14} strokeWidth={2.5} /> {timerDisplay}</> : <><TrendingDown size={17} strokeWidth={2.5} /> BAIXA</>}
                </button>
              </div>
            </div>
          );
        })()}
      </div>
    );
  }

  // ── DESKTOP RENDER ────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1e", fontFamily: "system-ui, -apple-system, sans-serif", userSelect: "none" }}>

      {notification && (
        <div style={{ position: "fixed", top: 70, left: "50%", transform: "translateX(-50%)", zIndex: 1000, background: notification.type === "win" ? "rgba(34,197,94,0.95)" : notification.type === "loss" ? "rgba(239,68,68,0.95)" : "rgba(245,166,35,0.95)", color: "#fff", padding: "12px 24px", borderRadius: 10, fontWeight: 700, fontSize: 15, boxShadow: "0 4px 20px rgba(0,0,0,0.4)", display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
          {notification.type === "win" ? <TrendingUp size={18} /> : notification.type === "loss" ? <TrendingDown size={18} /> : <AlertCircle size={18} />}
          {notification.msg}
        </div>
      )}

      {/* Desktop Topbar */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 56, zIndex: 100, background: "#080e1d", borderBottom: "1px solid #1e2d50", display: "flex", alignItems: "center", padding: "0 16px", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 150 }}>
          <div style={{ width: 30, height: 30, background: "linear-gradient(135deg,#f5a623,#e8940f)", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 12px rgba(245,166,35,0.3)" }}>
            <TrendingUp size={16} color="#0a0f1e" strokeWidth={2.5} />
          </div>
          <span style={{ color: "#fff", fontWeight: 900, fontSize: 14, letterSpacing: 0.3 }}>Dynamics Works</span>
        </div>

        {renderAssetDropdown()}

        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#0d1526", border: "1px solid #1e2d50", borderRadius: 8, padding: "5px 10px" }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: priceUp ? "#22c55e" : "#ef4444", boxShadow: priceUp ? "0 0 6px #22c55e" : "0 0 6px #ef4444" }} />
          <span style={{ fontSize: 16, fontWeight: 900, color: priceUp ? "#22c55e" : "#ef4444", fontVariantNumeric: "tabular-nums" }}>{priceStr}</span>
        </div>

        <div style={{ flex: 1 }} />

        <button onClick={toggleAccount} style={{
          background: isDemo ? "rgba(245,166,35,0.12)" : "rgba(34,197,94,0.12)",
          border: `1px solid ${isDemo ? "rgba(245,166,35,0.35)" : "rgba(34,197,94,0.35)"}`,
          borderRadius: 8, padding: "5px 12px",
          color: isDemo ? "#f5a623" : "#22c55e", cursor: "pointer", fontSize: 11, fontWeight: 800, letterSpacing: 0.5,
        }}>
          {isDemo ? "DEMO" : "REAL"}
        </button>

        <NotificationBell />

        <button onClick={toggleAccount} style={{ background: "#0d1526", border: "1px solid #1e2d50", borderRadius: 8, padding: "5px 12px", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
          <Wallet size={13} color="#f5a623" />
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 13, fontVariantNumeric: "tabular-nums" }}>{formatKz(Math.floor(displayBalance))}</span>
        </button>

        {isDemo && demoBalance < 5000 && (
          <button onClick={resetDemo} disabled={demoReloading} style={{ background: "transparent", border: "1px solid rgba(245,166,35,0.4)", color: "#f5a623", borderRadius: 6, fontSize: 11, padding: "4px 8px", cursor: demoReloading ? "not-allowed" : "pointer", opacity: demoReloading ? 0.6 : 1, whiteSpace: "nowrap" }}>
            {demoReloading ? "..." : "↺ Recarregar"}
          </button>
        )}

        <div style={{ position: "relative" }}>
          <button onClick={() => setUserMenuOpen(!userMenuOpen)}
            style={{ width: 36, height: 36, background: "#f5a623", borderRadius: "50%", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <User size={18} color="#0a0f1e" />
          </button>
          {userMenuOpen && (
            <div style={{ position: "absolute", top: "110%", right: 0, background: "#111827", border: "1px solid #1e2d50", borderRadius: 10, minWidth: 180, zIndex: 200 }}>
              <div style={{ padding: "12px 14px", borderBottom: "1px solid #1e2d50" }}>
                <div style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>{session?.user?.name}</div>
                <div style={{ color: "#94a3b8", fontSize: 12 }}>{session?.user?.email}</div>
              </div>
              <a href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", color: "#94a3b8", textDecoration: "none", fontSize: 13 }}><BarChart2 size={14} /> Dashboard</a>
              <a href="/history"   style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", color: "#94a3b8", textDecoration: "none", fontSize: 13 }}><BarChart2 size={14} /> Histórico</a>
              <a href="/ranking"   style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", color: "#94a3b8", textDecoration: "none", fontSize: 13 }}><Trophy size={14} /> Ranking</a>
              <a href="/wallet"    style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", color: "#94a3b8", textDecoration: "none", fontSize: 13 }}><Wallet size={14} /> Carteira</a>
              <a href="/profile"   style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", color: "#94a3b8", textDecoration: "none", fontSize: 13 }}><User size={14} /> Perfil</a>
              <button onClick={() => signOut({ callbackUrl: "/login" })}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", color: "#ef4444", background: "none", border: "none", cursor: "pointer", fontSize: 13 }}>
                <LogOut size={14} /> Sair
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Ticker bar */}
      <div style={{ position: "fixed", top: 56, left: 0, right: 0, height: 32, zIndex: 99, background: "#080e1d", borderBottom: "1px solid #1e2d50", overflow: "hidden", display: "flex", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 28, padding: "0 20px", animation: "ticker 30s linear infinite", whiteSpace: "nowrap" }}>
          {[...pairs, ...pairs].map((p, i) => {
            const price = tickerPrices[p.symbol] ?? 0;
            const seed  = SEED_PRICES[p.symbol] ?? 1;
            const isUp  = price >= seed;
            const pct   = seed > 0 && price > 0 ? ((price - seed) / seed * 100) : 0;
            return (
              <span key={i} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11 }}>
                <span style={{ color: "#64748b", fontWeight: 600 }}>{p.label}</span>
                <span style={{ color: isUp ? "#22c55e" : "#ef4444", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                  {price > 0 ? price.toFixed(p.decimals) : "—"}
                </span>
                {price > 0 && (
                  <span style={{ color: isUp ? "#16a34a" : "#dc2626", fontSize: 9, fontWeight: 600, background: isUp ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", borderRadius: 3, padding: "0px 3px" }}>
                    {isUp ? "+" : ""}{pct.toFixed(2)}%
                  </span>
                )}
              </span>
            );
          })}
        </div>
        <style>{`@keyframes ticker { from { transform:translateX(0) } to { transform:translateX(-50%) } }`}</style>
      </div>

      {/* Main content */}
      <div style={{ paddingTop: 88, height: "100vh", display: "flex" }}>
        {/* Chart area 70% */}
        <div style={{ flex: "0 0 70%", display: "flex", flexDirection: "column", borderRight: "1px solid #1e2d50" }}>
          <div style={{ padding: "6px 14px", background: "#080e1d", display: "flex", gap: 5, borderBottom: "1px solid #1e2d50", alignItems: "center" }}>
            {["1m", "5m", "15m", "1h", "1D"].map(tf => (
              <button key={tf} onClick={() => setTimeframe(tf)} style={{
                background: timeframe === tf ? "rgba(245,166,35,0.12)" : "transparent",
                color: timeframe === tf ? "#f5a623" : "#4b5563",
                border: `1px solid ${timeframe === tf ? "rgba(245,166,35,0.4)" : "#1e2d50"}`,
                borderRadius: 6, padding: "4px 11px", fontSize: 12, fontWeight: 700, cursor: "pointer",
                boxShadow: timeframe === tf ? "0 0 8px rgba(245,166,35,0.15)" : "none",
                transition: "all 0.12s",
              }}>{tf}</button>
            ))}
            <div style={{ flex: 1 }} />
            {candleTimer && (
              <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b", fontVariantNumeric: "tabular-nums", letterSpacing: 1 }}>
                {candleTimer}
              </span>
            )}
            <button onClick={() => setShowIndicators(v => !v)} style={{
              background: showIndicators ? "rgba(245,166,35,0.12)" : "transparent",
              color: showIndicators ? "#f5a623" : "#4b5563",
              border: `1px solid ${showIndicators ? "rgba(245,166,35,0.4)" : "#1e2d50"}`,
              borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer",
              transition: "all 0.12s",
            }}>Indicadores</button>
          </div>
          {showIndicators && renderIndicatorPanel()}
          <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
            <div ref={chartRef} style={{ width: "100%", height: "100%" }} />
            {renderLegend()}
            <div style={{ position: "absolute", inset: 0, zIndex: 2, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
              <span style={{ fontSize: 52, fontWeight: 900, color: "rgba(255,255,255,0.08)", letterSpacing: 4, userSelect: "none" }}>{selectedPair?.label}</span>
            </div>
            {/* Zoom controls — bottom centre, over time axis */}
            <div style={{ position: "absolute", bottom: 6, left: "50%", transform: "translateX(-50%)", zIndex: 6, display: "flex", gap: 4 }}>
              <button onClick={() => { const ts = chartApiRef.current?.timeScale(); if (!ts) return; const cur = (ts.options() as any).barSpacing ?? 6; ts.applyOptions({ barSpacing: Math.max(cur - 2, 2) }); }}
                style={{ width: 28, height: 22, background: "rgba(8,14,29,0.85)", border: "1px solid #1e2d50", borderRadius: 5, color: "#64748b", fontSize: 15, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
              <button onClick={() => { const ts = chartApiRef.current?.timeScale(); if (!ts) return; const cur = (ts.options() as any).barSpacing ?? 6; ts.applyOptions({ barSpacing: Math.min(cur + 2, 40) }); }}
                style={{ width: 28, height: 22, background: "rgba(8,14,29,0.85)", border: "1px solid #1e2d50", borderRadius: 5, color: "#64748b", fontSize: 15, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
            </div>
          </div>
        </div>

        {/* Right panel 30% */}
        <div style={{ flex: "0 0 30%", overflowY: "auto", padding: 16, background: "#080e1d" }}>
          {renderTradePanel()}
        </div>
      </div>
    </div>
  );
}
