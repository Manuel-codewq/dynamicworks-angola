"use client";
import { formatKz } from "@/lib/format";
import { useState, useEffect, useRef, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  TrendingUp, TrendingDown, ChevronDown, Wallet,
  User, LogOut, BarChart2, AlertCircle, X, Trophy,
  Clock, History, Headphones, MessageCircle,
  PenLine, CandlestickChart, LineChart, AreaChart,
  Maximize2, Minimize2, Minus, Sliders, Trash2,
  Square, GitFork, BarChart, Activity,
} from "lucide-react";
import {
  createChart, IChartApi, ISeriesApi, CandlestickData, Time,
  CandlestickSeries, LineSeries, HistogramSeries, AreaSeries, BarSeries,
} from "lightweight-charts";
import {
  derivWS, GRANULARITY, getAvailablePairs, isRealMarketOpen,
  type DerivPair, type DerivCandle,
} from "@/lib/derivWebSocket";
import NotificationBell from "@/app/components/NotificationBell";
import TradeResultOverlay from "@/app/components/TradeResultOverlay";
import OnboardingTutorial from "@/app/components/OnboardingTutorial";
import {
  calcSMA, calcEMA, calcBB, calcRSI, calcMACD, calcStochastic,
  calcATR, calcCCI, calcWilliamsR, calcMomentum, calcAO, calcADX,
  calcAlligator, calcDonchian, calcKeltner, calcParabolicSAR, calcBearsBulls,
} from "@/lib/indicators";

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
  // Sintéticos DW
  R_10: 6300,  R_25: 5800,  R_50: 4500,  R_75: 3700,  R_100: 9800,
  BOOM300N: 7800,  CRASH300N: 7800,
  BOOM500:  8200,  CRASH500:  8200,
};

// ── Helpers ──────────────────────────────────────────────────────────────────


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
    let prevW = window.innerWidth;
    const check = () => {
      const w = window.innerWidth;
      setIsMobile(w < 768);
      // Só atualiza a altura em mudanças de largura (rotação do ecrã),
      // nunca por abertura do teclado virtual (que só muda a altura)
      if (w !== prevW) { setWindowHeight(window.innerHeight); prevW = w; }
    };
    setIsMobile(window.innerWidth < 768);
    setWindowHeight(window.innerHeight);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ── Available pairs — polls /api/market-mode every 15s (reacts to admin changes) ─
  const [pairs,        setPairs]        = useState<DerivPair[]>([]);
  const [selectedPair, setSelectedPair] = useState<DerivPair | null>(null);

  useEffect(() => {
    function refreshPairs() {
      const list = getAvailablePairs();
      setPairs(list);
      setSelectedPair(prev => {
        // Mantém o par selecionado se ainda estiver disponível; caso contrário troca para o primeiro
        if (prev && list.some(p => p.symbol === prev.symbol)) return prev;
        return list[0];
      });
    }
    refreshPairs();
    // Verifica a cada 60s se o horário de mercado mudou (troca real ↔ sintético às 18h)
    const id = setInterval(refreshPairs, 60_000);
    return () => clearInterval(id);
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
  const [mobileTab,     setMobileTab]     = useState<"chart" | "trade" | "wallet" | "account" | "markets">("chart");
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
  const [walletData,      setWalletData]      = useState<{ balance: number; demoBalance: number; transactions: any[] } | null>(null);
  const [walletLoading,   setWalletLoading]   = useState(false);

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

  // ── Drawing tools ─────────────────────────────────────────────────────────
  type DrawingTool = "hline" | "trendline" | "fibonacci" | "rectangle" | null;
  interface HLineDrawing  { id: string; type: "hline";     price: number;    color: string; lineWidth: number; lineStyle: number; label: string; }
  interface TrendDrawing  { id: string; type: "trendline"; p1Time: number; p1Price: number; p2Time: number; p2Price: number; color: string; lineWidth: number; lineStyle: number; }
  type Drawing = HLineDrawing | TrendDrawing;

  const TOOL_COLORS = ["#f5a623","#3b82f6","#22c55e","#ef4444","#a78bfa","#22d3ee","#e2e8f0"];

  const [activeTool,     setActiveTool]     = useState<DrawingTool>(null);
  const [drawings,       setDrawings]       = useState<Drawing[]>([]);
  const [showTools,      setShowTools]      = useState(false);
  const [toolColor,      setToolColor]      = useState("#f5a623");
  const [toolLineStyle,  setToolLineStyle]  = useState(0);
  const [toolLineWidth,  setToolLineWidth]  = useState(1);
  const [toolLabel,      setToolLabel]      = useState("");
  const [pendingPoint,   setPendingPoint]   = useState<{ time: number; price: number } | null>(null);
  const draggingHLine = useRef<string | null>(null);

  // ── Indicator state + refs ───────────────────────────────────────────────
  const [showIndicators, setShowIndicators] = useState(false);
  // Quotex-style left panel
  type LeftPanel = "indicators" | "drawings" | null;
  const [leftPanel,    setLeftPanel]    = useState<LeftPanel>(null);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [pendingCfg,   setPendingCfg]   = useState<Record<string, any>>({});
  // Chart type
  type ChartType = "candle" | "line" | "area" | "bar";
  const [chartType, setChartType] = useState<ChartType>("candle");
  const chartTypeRef = useRef<ChartType>("candle");
  useEffect(() => { chartTypeRef.current = chartType; }, [chartType]);

  const DEFAULT_INDICATORS = {
    ma:         { enabled: false, periods: [20] as number[] },
    ema:        { enabled: false, periods: [20] as number[] },
    bb:         { enabled: false, period: 20 },
    rsi:        { enabled: false, period: 14 },
    macd:       { enabled: false, fast: 12, slow: 26, signal: 9 },
    stoch:      { enabled: false, kPeriod: 14, dPeriod: 3 },
    alligator:  { enabled: false },
    donchian:   { enabled: false, period: 20 },
    keltner:    { enabled: false, period: 20, mult: 2 },
    sar:        { enabled: false, step: 0.02, max: 0.2 },
    atr:        { enabled: false, period: 14 },
    cci:        { enabled: false, period: 20 },
    willr:      { enabled: false, period: 14 },
    momentum:   { enabled: false, period: 10 },
    ao:         { enabled: false },
    adx:        { enabled: false, period: 14 },
    bearsbulls: { enabled: false, period: 13 },
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
          ma:         migrateMA("ma"),
          ema:        migrateMA("ema"),
          bb:         { ...DEFAULT_INDICATORS.bb,         ...(p.bb         ?? {}) },
          rsi:        { ...DEFAULT_INDICATORS.rsi,        ...(p.rsi        ?? {}) },
          macd:       { ...DEFAULT_INDICATORS.macd,       ...(p.macd       ?? {}) },
          stoch:      { ...DEFAULT_INDICATORS.stoch,      ...(p.stoch      ?? {}) },
          alligator:  { ...DEFAULT_INDICATORS.alligator,  ...(p.alligator  ?? {}) },
          donchian:   { ...DEFAULT_INDICATORS.donchian,   ...(p.donchian   ?? {}) },
          keltner:    { ...DEFAULT_INDICATORS.keltner,    ...(p.keltner    ?? {}) },
          sar:        { ...DEFAULT_INDICATORS.sar,        ...(p.sar        ?? {}) },
          atr:        { ...DEFAULT_INDICATORS.atr,        ...(p.atr        ?? {}) },
          cci:        { ...DEFAULT_INDICATORS.cci,        ...(p.cci        ?? {}) },
          willr:      { ...DEFAULT_INDICATORS.willr,      ...(p.willr      ?? {}) },
          momentum:   { ...DEFAULT_INDICATORS.momentum,   ...(p.momentum   ?? {}) },
          ao:         { ...DEFAULT_INDICATORS.ao,         ...(p.ao         ?? {}) },
          adx:        { ...DEFAULT_INDICATORS.adx,        ...(p.adx        ?? {}) },
          bearsbulls: { ...DEFAULT_INDICATORS.bearsbulls, ...(p.bearsbulls ?? {}) },
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
          ma:         { ...DEFAULT_INDICATORS.ma,         ...(p.ma         ?? {}) },
          ema:        { ...DEFAULT_INDICATORS.ema,        ...(p.ema        ?? {}) },
          bb:         { ...DEFAULT_INDICATORS.bb,         ...(p.bb         ?? {}) },
          rsi:        { ...DEFAULT_INDICATORS.rsi,        ...(p.rsi        ?? {}) },
          macd:       { ...DEFAULT_INDICATORS.macd,       ...(p.macd       ?? {}) },
          stoch:      { ...DEFAULT_INDICATORS.stoch,      ...(p.stoch      ?? {}) },
          alligator:  { ...DEFAULT_INDICATORS.alligator,  ...(p.alligator  ?? {}) },
          donchian:   { ...DEFAULT_INDICATORS.donchian,   ...(p.donchian   ?? {}) },
          keltner:    { ...DEFAULT_INDICATORS.keltner,    ...(p.keltner    ?? {}) },
          sar:        { ...DEFAULT_INDICATORS.sar,        ...(p.sar        ?? {}) },
          atr:        { ...DEFAULT_INDICATORS.atr,        ...(p.atr        ?? {}) },
          cci:        { ...DEFAULT_INDICATORS.cci,        ...(p.cci        ?? {}) },
          willr:      { ...DEFAULT_INDICATORS.willr,      ...(p.willr      ?? {}) },
          momentum:   { ...DEFAULT_INDICATORS.momentum,   ...(p.momentum   ?? {}) },
          ao:         { ...DEFAULT_INDICATORS.ao,         ...(p.ao         ?? {}) },
          adx:        { ...DEFAULT_INDICATORS.adx,        ...(p.adx        ?? {}) },
          bearsbulls: { ...DEFAULT_INDICATORS.bearsbulls, ...(p.bearsbulls ?? {}) },
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
  // New indicator refs
  const alligatorJawRef   = useRef<ISeriesApi<"Line"> | null>(null);
  const alligatorTeethRef = useRef<ISeriesApi<"Line"> | null>(null);
  const alligatorLipsRef  = useRef<ISeriesApi<"Line"> | null>(null);
  const donchianHighRef   = useRef<ISeriesApi<"Line"> | null>(null);
  const donchianMidRef    = useRef<ISeriesApi<"Line"> | null>(null);
  const donchianLowRef    = useRef<ISeriesApi<"Line"> | null>(null);
  const keltnerHighRef    = useRef<ISeriesApi<"Line"> | null>(null);
  const keltnerMidRef     = useRef<ISeriesApi<"Line"> | null>(null);
  const keltnerLowRef     = useRef<ISeriesApi<"Line"> | null>(null);
  const sarSeriesRef      = useRef<ISeriesApi<"Line"> | null>(null);
  const atrSeriesRef      = useRef<ISeriesApi<"Line"> | null>(null);
  const atrPaneRef        = useRef<any>(null);
  const cciSeriesRef      = useRef<ISeriesApi<"Line"> | null>(null);
  const cciPaneRef        = useRef<any>(null);
  const willrSeriesRef    = useRef<ISeriesApi<"Line"> | null>(null);
  const willrPaneRef      = useRef<any>(null);
  const momentumSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const momentumPaneRef   = useRef<any>(null);
  const aoSeriesRef       = useRef<ISeriesApi<"Histogram"> | null>(null);
  const aoPaneRef         = useRef<any>(null);
  const adxSeriesRef      = useRef<ISeriesApi<"Line"> | null>(null);
  const adxPlusRef        = useRef<ISeriesApi<"Line"> | null>(null);
  const adxMinusRef       = useRef<ISeriesApi<"Line"> | null>(null);
  const adxPaneRef        = useRef<any>(null);
  const bearsSeriesRef    = useRef<ISeriesApi<"Histogram"> | null>(null);
  const bullsSeriesRef    = useRef<ISeriesApi<"Histogram"> | null>(null);
  const bearsbullsPaneRef = useRef<any>(null);
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
  // Drawing tool refs
  const activeToolRef    = useRef<DrawingTool>(null);
  const pendingPointRef  = useRef<{ time: number; price: number } | null>(null);
  const drawingsRef      = useRef<Drawing[]>([]);
  const toolColorRef     = useRef("#f5a623");
  const toolLineStyleRef = useRef(0);
  const toolLineWidthRef = useRef(1);
  const toolLabelRef     = useRef("");
  const hlineRefsMap     = useRef<Map<string, any>>(new Map());
  const trendSeriesMap   = useRef<Map<string, ISeriesApi<"Line">>>(new Map());


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

  // Drawing refs sync
  useEffect(() => { activeToolRef.current    = activeTool; },    [activeTool]);
  useEffect(() => { pendingPointRef.current  = pendingPoint; },  [pendingPoint]);
  useEffect(() => { drawingsRef.current      = drawings; },      [drawings]);
  useEffect(() => { toolColorRef.current     = toolColor; },     [toolColor]);
  useEffect(() => { toolLineStyleRef.current = toolLineStyle; }, [toolLineStyle]);
  useEffect(() => { toolLineWidthRef.current = toolLineWidth; }, [toolLineWidth]);
  useEffect(() => { toolLabelRef.current     = toolLabel; },     [toolLabel]);

  // Escape key cancels pending point
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setPendingPoint(null); pendingPointRef.current = null; setActiveTool(null); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── Drawing functions ────────────────────────────────────────────────────
  function applyHLine(d: HLineDrawing) {
    if (!candleSeriesRef.current) return;
    const ref = candleSeriesRef.current.createPriceLine({
      price: d.price, color: d.color, lineWidth: d.lineWidth as any,
      lineStyle: d.lineStyle, axisLabelVisible: true, title: d.label || "",
    });
    hlineRefsMap.current.set(d.id, ref);
  }
  function removeHLine(id: string) {
    const ref = hlineRefsMap.current.get(id);
    if (ref && candleSeriesRef.current) { try { candleSeriesRef.current.removePriceLine(ref); } catch {} }
    hlineRefsMap.current.delete(id);
  }

  function applyTrendLine(d: TrendDrawing) {
    if (!chartApiRef.current) return;
    const dt = d.p2Time - d.p1Time;
    if (dt === 0) return;
    const slope = (d.p2Price - d.p1Price) / dt;

    // Extend only 300 bars beyond the clicked points to avoid auto-zoom
    const granSecs = GRANULARITY[timeframeRef.current] ?? 60;
    const pad = 300 * granSecs;
    const tStart = Math.min(d.p1Time, d.p2Time) - pad;
    const tEnd   = Math.max(d.p1Time, d.p2Time) + pad;

    // Save visible range before adding series so the chart doesn't zoom out
    const visibleRange = chartApiRef.current.timeScale().getVisibleRange();

    const series = chartApiRef.current.addSeries(LineSeries, {
      color: d.color, lineWidth: d.lineWidth as any, lineStyle: d.lineStyle,
      priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
    });
    series.setData([
      { time: tStart as Time, value: d.p1Price + slope * (tStart - d.p1Time) },
      { time: tEnd   as Time, value: d.p1Price + slope * (tEnd   - d.p1Time) },
    ]);

    // Restore visible range so chart stays where it was
    if (visibleRange) {
      requestAnimationFrame(() => {
        chartApiRef.current?.timeScale().setVisibleRange(visibleRange);
      });
    }

    trendSeriesMap.current.set(d.id, series);
  }
  function removeTrendLine(id: string) {
    const series = trendSeriesMap.current.get(id);
    if (series && chartApiRef.current) { try { chartApiRef.current.removeSeries(series); } catch {} }
    trendSeriesMap.current.delete(id);
  }

  function addDrawing(d: Drawing) {
    setDrawings(prev => [...prev, d]);
    drawingsRef.current = [...drawingsRef.current, d];
    if (d.type === "hline")     applyHLine(d);
    if (d.type === "trendline") applyTrendLine(d);
  }
  function removeDrawing(id: string) {
    const d = drawingsRef.current.find(x => x.id === id);
    if (!d) return;
    if (d.type === "hline")     removeHLine(id);
    if (d.type === "trendline") removeTrendLine(id);
    setDrawings(prev => prev.filter(x => x.id !== id));
    drawingsRef.current = drawingsRef.current.filter(x => x.id !== id);
  }
  function clearAllDrawings() {
    drawingsRef.current.forEach(d => {
      if (d.type === "hline")     removeHLine(d.id);
      if (d.type === "trendline") removeTrendLine(d.id);
    });
    setDrawings([]);
    drawingsRef.current = [];
  }
  function reapplyDrawings() {
    hlineRefsMap.current.clear();
    trendSeriesMap.current.clear();
    drawingsRef.current.forEach(d => {
      if (d.type === "hline")     applyHLine(d);
      if (d.type === "trendline") applyTrendLine(d);
    });
  }

  // ── HLine drag handlers ──────────────────────────────────────────────────
  function onChartPointerDown(clientY: number) {
    if (activeTool || !candleSeriesRef.current || !chartRef.current) return;
    const rect = chartRef.current.getBoundingClientRect();
    const y = clientY - rect.top;
    for (const d of drawingsRef.current) {
      if (d.type !== "hline") continue;
      const coord = candleSeriesRef.current.priceToCoordinate((d as HLineDrawing).price);
      if (coord !== null && Math.abs(coord - y) < 10) {
        draggingHLine.current = d.id;
        break;
      }
    }
  }
  function onChartPointerMove(clientY: number) {
    if (!draggingHLine.current || !candleSeriesRef.current || !chartRef.current) return;
    const rect = chartRef.current.getBoundingClientRect();
    const y = clientY - rect.top;
    const newPrice = candleSeriesRef.current.coordinateToPrice(y);
    if (!newPrice) return;
    const id = draggingHLine.current;
    const ref = hlineRefsMap.current.get(id);
    if (ref) ref.applyOptions({ price: newPrice });
    drawingsRef.current = drawingsRef.current.map(x =>
      x.id === id && x.type === "hline" ? { ...x as HLineDrawing, price: newPrice } : x
    );
    setDrawings(prev => prev.map(x =>
      x.id === id && x.type === "hline" ? { ...x as HLineDrawing, price: newPrice } : x
    ));
  }
  function onChartPointerUp() { draggingHLine.current = null; }

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

    // ── Alligator ──
    const oLine = { priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false } as const;
    if (cfg.alligator.enabled) {
      const al = calcAlligator(data);
      if (!alligatorJawRef.current) {
        alligatorJawRef.current   = chart.addSeries(LineSeries, { ...oLine, color: "#3b82f6", lineWidth: 2 });
        alligatorTeethRef.current = chart.addSeries(LineSeries, { ...oLine, color: "#ef4444", lineWidth: 2 });
        alligatorLipsRef.current  = chart.addSeries(LineSeries, { ...oLine, color: "#22c55e", lineWidth: 2 });
      }
      alligatorJawRef.current.setData(al.jaw);
      alligatorTeethRef.current!.setData(al.teeth);
      alligatorLipsRef.current!.setData(al.lips);
    } else if (alligatorJawRef.current) {
      [alligatorJawRef, alligatorTeethRef, alligatorLipsRef].forEach(r => { if (r.current) { chart.removeSeries(r.current); r.current = null; } });
    }

    // ── Donchian ──
    if (cfg.donchian.enabled) {
      const dc = calcDonchian(data, cfg.donchian.period);
      if (!donchianHighRef.current) {
        donchianHighRef.current = chart.addSeries(LineSeries, { ...oLine, color: "#fbbf24", lineWidth: 1 });
        donchianMidRef.current  = chart.addSeries(LineSeries, { ...oLine, color: "#fbbf2460", lineWidth: 1, lineStyle: 2 });
        donchianLowRef.current  = chart.addSeries(LineSeries, { ...oLine, color: "#fbbf24", lineWidth: 1 });
      }
      donchianHighRef.current.setData(dc.high);
      donchianMidRef.current!.setData(dc.mid);
      donchianLowRef.current!.setData(dc.low);
    } else if (donchianHighRef.current) {
      [donchianHighRef, donchianMidRef, donchianLowRef].forEach(r => { if (r.current) { chart.removeSeries(r.current); r.current = null; } });
    }

    // ── Keltner ──
    if (cfg.keltner.enabled) {
      const kc = calcKeltner(data, cfg.keltner.period, cfg.keltner.mult);
      if (!keltnerHighRef.current) {
        keltnerHighRef.current = chart.addSeries(LineSeries, { ...oLine, color: "#c084fc", lineWidth: 1 });
        keltnerMidRef.current  = chart.addSeries(LineSeries, { ...oLine, color: "#c084fc60", lineWidth: 1, lineStyle: 2 });
        keltnerLowRef.current  = chart.addSeries(LineSeries, { ...oLine, color: "#c084fc", lineWidth: 1 });
      }
      keltnerHighRef.current.setData(kc.upper);
      keltnerMidRef.current!.setData(kc.mid);
      keltnerLowRef.current!.setData(kc.lower);
    } else if (keltnerHighRef.current) {
      [keltnerHighRef, keltnerMidRef, keltnerLowRef].forEach(r => { if (r.current) { chart.removeSeries(r.current); r.current = null; } });
    }

    // ── Parabolic SAR ──
    if (cfg.sar.enabled) {
      if (!sarSeriesRef.current) sarSeriesRef.current = chart.addSeries(LineSeries, { ...oLine, color: "#f97316", lineWidth: 1, lineStyle: 4 });
      sarSeriesRef.current.setData(calcParabolicSAR(data, cfg.sar.step, cfg.sar.max));
    } else if (sarSeriesRef.current) { chart.removeSeries(sarSeriesRef.current); sarSeriesRef.current = null; }

    // Helper to remove a pane
    const removePane = (ref: React.MutableRefObject<any>) => {
      if (ref.current) { const idx = chart.panes().indexOf(ref.current); if (idx > 0) try { chart.removePane(idx); } catch {} ref.current = null; }
    };

    // ── ATR (pane) ──
    if (cfg.atr.enabled) {
      if (!atrSeriesRef.current) {
        const pi = chart.panes().length;
        atrSeriesRef.current = chart.addSeries(LineSeries, { ...lineOpts, color: "#fb923c", lineWidth: 2 }, pi);
        atrPaneRef.current   = chart.panes()[pi];
      }
      const d = calcATR(data, cfg.atr.period);
      atrSeriesRef.current.setData(d);
      if (d.length > 0) leg.push({ label: `ATR ${cfg.atr.period}`, value: d[d.length-1].value.toFixed(dec), color: "#fb923c" });
    } else if (atrSeriesRef.current) { chart.removeSeries(atrSeriesRef.current); atrSeriesRef.current = null; removePane(atrPaneRef); }

    // ── CCI (pane) ──
    if (cfg.cci.enabled) {
      if (!cciSeriesRef.current) {
        const pi = chart.panes().length;
        cciSeriesRef.current = chart.addSeries(LineSeries, { ...lineOpts, color: "#f43f5e", lineWidth: 2 }, pi);
        cciPaneRef.current   = chart.panes()[pi];
        cciSeriesRef.current.createPriceLine({ price:  100, color: "#ef444470", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "100" });
        cciSeriesRef.current.createPriceLine({ price: -100, color: "#22c55e70", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "-100" });
      }
      const d = calcCCI(data, cfg.cci.period);
      cciSeriesRef.current.setData(d);
      if (d.length > 0) leg.push({ label: `CCI ${cfg.cci.period}`, value: d[d.length-1].value.toFixed(1), color: "#f43f5e" });
    } else if (cciSeriesRef.current) { chart.removeSeries(cciSeriesRef.current); cciSeriesRef.current = null; removePane(cciPaneRef); }

    // ── Williams %R (pane) ──
    if (cfg.willr.enabled) {
      if (!willrSeriesRef.current) {
        const pi = chart.panes().length;
        willrSeriesRef.current = chart.addSeries(LineSeries, { ...lineOpts, color: "#818cf8", lineWidth: 2 }, pi);
        willrPaneRef.current   = chart.panes()[pi];
        willrSeriesRef.current.createPriceLine({ price: -20, color: "#ef444470", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "-20" });
        willrSeriesRef.current.createPriceLine({ price: -80, color: "#22c55e70", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "-80" });
      }
      const d = calcWilliamsR(data, cfg.willr.period);
      willrSeriesRef.current.setData(d);
      if (d.length > 0) leg.push({ label: `%R ${cfg.willr.period}`, value: d[d.length-1].value.toFixed(1), color: "#818cf8" });
    } else if (willrSeriesRef.current) { chart.removeSeries(willrSeriesRef.current); willrSeriesRef.current = null; removePane(willrPaneRef); }

    // ── Momentum (pane) ──
    if (cfg.momentum.enabled) {
      if (!momentumSeriesRef.current) {
        const pi = chart.panes().length;
        momentumSeriesRef.current = chart.addSeries(LineSeries, { ...lineOpts, color: "#2dd4bf", lineWidth: 2 }, pi);
        momentumPaneRef.current   = chart.panes()[pi];
        momentumSeriesRef.current.createPriceLine({ price: 0, color: "#64748b", lineWidth: 1, lineStyle: 0, axisLabelVisible: true, title: "0" });
      }
      const d = calcMomentum(data, cfg.momentum.period);
      momentumSeriesRef.current.setData(d);
      if (d.length > 0) leg.push({ label: `MOM ${cfg.momentum.period}`, value: d[d.length-1].value.toFixed(dec), color: "#2dd4bf" });
    } else if (momentumSeriesRef.current) { chart.removeSeries(momentumSeriesRef.current); momentumSeriesRef.current = null; removePane(momentumPaneRef); }

    // ── Awesome Oscillator (pane) ──
    if (cfg.ao.enabled) {
      if (!aoSeriesRef.current) {
        const pi = chart.panes().length;
        aoSeriesRef.current = chart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false }, pi);
        aoPaneRef.current   = chart.panes()[pi];
      }
      aoSeriesRef.current.setData(calcAO(data));
    } else if (aoSeriesRef.current) { chart.removeSeries(aoSeriesRef.current); aoSeriesRef.current = null; removePane(aoPaneRef); }

    // ── ADX (pane) ──
    if (cfg.adx.enabled) {
      if (!adxSeriesRef.current) {
        const pi = chart.panes().length;
        adxSeriesRef.current  = chart.addSeries(LineSeries, { ...lineOpts, color: "#f5a623", lineWidth: 2 }, pi);
        adxPlusRef.current    = chart.addSeries(LineSeries, { ...lineOpts, color: "#22c55e",  lineWidth: 1, lastValueVisible: false }, pi);
        adxMinusRef.current   = chart.addSeries(LineSeries, { ...lineOpts, color: "#ef4444",  lineWidth: 1, lastValueVisible: false }, pi);
        adxPaneRef.current    = chart.panes()[pi];
        adxSeriesRef.current.createPriceLine({ price: 25, color: "#64748b70", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "25" });
      }
      const adxData = calcADX(data, cfg.adx.period);
      adxSeriesRef.current.setData(adxData.adx);
      adxPlusRef.current!.setData(adxData.diPlus);
      adxMinusRef.current!.setData(adxData.diMinus);
      if (adxData.adx.length > 0) leg.push({ label: `ADX`, value: adxData.adx[adxData.adx.length-1].value.toFixed(1), color: "#f5a623" });
    } else if (adxSeriesRef.current) {
      [adxSeriesRef, adxPlusRef, adxMinusRef].forEach(r => { if (r.current) { chart.removeSeries(r.current); r.current = null; } });
      removePane(adxPaneRef);
    }

    // ── Bears/Bulls Power (pane) ──
    if (cfg.bearsbulls.enabled) {
      if (!bearsSeriesRef.current) {
        const pi = chart.panes().length;
        bearsSeriesRef.current   = chart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false, color: "#ef4444" }, pi);
        bullsSeriesRef.current   = chart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false, color: "#22c55e" }, pi);
        bearsbullsPaneRef.current = chart.panes()[pi];
      }
      const bb2 = calcBearsBulls(data, cfg.bearsbulls.period);
      bearsSeriesRef.current.setData(bb2.bears.map(v => ({ ...v, color: "#ef444480" })));
      bullsSeriesRef.current!.setData(bb2.bulls.map(v => ({ ...v, color: "#22c55e80" })));
    } else if (bearsSeriesRef.current) {
      [bearsSeriesRef, bullsSeriesRef].forEach(r => { if (r.current) { chart.removeSeries(r.current); r.current = null; } });
      removePane(bearsbullsPaneRef);
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
        const ct3 = chartTypeRef.current;
        if (ct3 === "line" || ct3 === "area") {
          candleSeriesRef.current.update({ time: candleTime, value: q } as any);
        } else {
          candleSeriesRef.current.update(newC);
        }
        candleDataRef.current = [...candleDataRef.current, newC];
        recalcRef.current();
      } else {
        const updated: CandlestickData = {
          ...c, high: Math.max(c.high, q), low: Math.min(c.low, q), close: q,
        };
        currentCandleRef.current = updated;
        const ct3 = chartTypeRef.current;
        if (ct3 === "line" || ct3 === "area") {
          candleSeriesRef.current.update({ time: updated.time, value: q } as any);
        } else {
          candleSeriesRef.current.update(updated);
        }
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

      const ct2 = chartTypeRef.current;
      if (ct2 === "line" || ct2 === "area") {
        candleSeriesRef.current.setData(candles.map(c => ({ time: c.time, value: c.close })) as any);
      } else {
        candleSeriesRef.current.setData(candles);
      }
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

    // Pause tick → candle updates until new candles arrive (prevents erratic movement during TF switch)
    reconnectingRef.current = true;

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
    if (isMobile && typeof window === "undefined") return;

    const TOPBAR_H     = 48;
    const TF_H         = 36;
    const TRADEPANEL_H = 162;
    const BOTTOMNAV_H  = 52;

    function initChart() {
      const el = chartRef.current;
      if (!el) return;
      if (chartApiRef.current) { chartApiRef.current.remove(); chartApiRef.current = null; }

      const w = el.clientWidth  || window.innerWidth;
      // Lê a altura do elemento (definida por CSS bottom:) em vez de calcular via windowHeight
      const h = el.clientHeight || (isMobile
        ? window.innerHeight - TOPBAR_H - TF_H - TRADEPANEL_H - BOTTOMNAV_H
        : (chartRef.current?.clientHeight || 500));
      if (w === 0 || h === 0) return;

      const chart = createChart(el, {
        layout: { background: { color: "#0a0f1e" }, textColor: "#94a3b8", attributionLogo: false },
        grid:   { vertLines: { color: "#1e2d50" }, horzLines: { color: "#1e2d50" } },
        crosshair: { mode: 1 },
        timeScale: {
          borderColor: "#1e2d50", timeVisible: true,
          rightOffset: isMobile ? 5 : 8,
          barSpacing: isMobile ? 10 : 6,
          fixLeftEdge: false,
          lockVisibleTimeRangeOnResize: false,
          shiftVisibleRangeOnNewBar: true,
          tickMarkFormatter: isMobile ? (time: number) => {
            const d = new Date(time * 1000);
            return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
          } : undefined,
        },
        rightPriceScale: {
          borderColor: "#1e2d50",
          autoScale:   true,
          scaleMargins: { top: isMobile ? 0.08 : 0.1, bottom: isMobile ? 0.08 : 0.1 },
          minimumWidth: isMobile ? 58 : undefined,
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
      const priceFormat = { type: "price" as const, precision: dec, minMove: Math.pow(10, -dec) };
      const ct = chartTypeRef.current;
      let series: ISeriesApi<any>;
      if (ct === "line") {
        series = chart.addSeries(LineSeries, { color: "#f5a623", lineWidth: 2, priceFormat, lastValueVisible: false, priceLineVisible: false });
      } else if (ct === "area") {
        series = chart.addSeries(AreaSeries, { lineColor: "#f5a623", topColor: "rgba(245,166,35,0.3)", bottomColor: "rgba(245,166,35,0.0)", lineWidth: 2, priceFormat, lastValueVisible: false, priceLineVisible: false });
      } else if (ct === "bar") {
        series = chart.addSeries(BarSeries, { upColor: "#22c55e", downColor: "#ef4444", priceFormat, lastValueVisible: false });
      } else {
        series = chart.addSeries(CandlestickSeries, { upColor: "#22c55e", downColor: "#ef4444", borderUpColor: "#22c55e", borderDownColor: "#ef4444", wickUpColor: "#22c55e", wickDownColor: "#ef4444", lastValueVisible: false, priceFormat });
      }
      candleSeriesRef.current  = series;
      currentCandleRef.current = null;
      tradePriceLinesRef.current.clear();
      if (ct === "candle" || ct === "bar") {
        livePriceLineRef.current = series.createPriceLine({ price: SEED_PRICES[selectedPair?.symbol ?? ""] ?? 1, color: "#22c55e", lineWidth: 1, lineStyle: 0, axisLabelVisible: true, title: "" });
      }
      // Null indicator refs — chart.remove() invalidated them
      maSeriesRefs.current.clear(); emaSeriesRefs.current.clear();
      bbUpperRef.current  = null; bbMiddleRef.current  = null; bbLowerRef.current = null;
      alligatorJawRef.current = null; alligatorTeethRef.current = null; alligatorLipsRef.current = null;
      donchianHighRef.current = null; donchianMidRef.current = null; donchianLowRef.current = null;
      keltnerHighRef.current = null; keltnerMidRef.current = null; keltnerLowRef.current = null;
      sarSeriesRef.current = null; atrSeriesRef.current = null; atrPaneRef.current = null;
      cciSeriesRef.current = null; cciPaneRef.current = null;
      willrSeriesRef.current = null; willrPaneRef.current = null;
      momentumSeriesRef.current = null; momentumPaneRef.current = null;
      aoSeriesRef.current = null; aoPaneRef.current = null;
      adxSeriesRef.current = null; adxPlusRef.current = null; adxMinusRef.current = null; adxPaneRef.current = null;
      bearsSeriesRef.current = null; bullsSeriesRef.current = null; bearsbullsPaneRef.current = null;
      rsiSeriesRef.current = null;  rsiPaneRef.current  = null;
      macdLineRef.current = null; macdSignalRef.current = null; macdHistRef.current = null; macdPaneRef.current = null;
      stochKRef.current = null; stochDRef.current = null; stochPaneRef.current = null;

      // Mostrar placeholder imediatamente enquanto os dados reais chegam via WS
      const basePrice = SEED_PRICES[selectedPair?.symbol ?? ""] ?? 1;
      const gran = GRANULARITY[timeframeRef.current] ?? 60;
      const placeholder = generatePlaceholder(basePrice, 120, gran);
      const ct4 = chartTypeRef.current;
      if (ct4 === "line" || ct4 === "area") {
        series.setData(placeholder.map(c => ({ time: c.time, value: c.close })) as any);
      } else {
        series.setData(placeholder);
      }
      candleDataRef.current = placeholder;
      currentCandleRef.current = placeholder[placeholder.length - 1] ?? null;

      // Re-apply drawings after chart reinit (refs were invalidated by chart.remove())
      reapplyDrawings();

      // Chart click → place drawing
      chart.subscribeClick((param) => {
        const tool = activeToolRef.current;
        if (!tool || !candleSeriesRef.current || !param.point || !param.time) return;
        const price = candleSeriesRef.current.coordinateToPrice(param.point.y);
        const time  = param.time as number;
        if (!price) return;
        const id   = `${tool}_${Date.now()}`;
        const base = { id, color: toolColorRef.current, lineWidth: toolLineWidthRef.current, lineStyle: toolLineStyleRef.current };
        if (tool === "hline") {
          addDrawing({ ...base, type: "hline", price, label: toolLabelRef.current });
        } else if (tool === "trendline") {
          const pending = pendingPointRef.current;
          if (!pending) {
            pendingPointRef.current = { time, price };
            setPendingPoint({ time, price });
          } else {
            addDrawing({ ...base, type: "trendline", p1Time: pending.time, p1Price: pending.price, p2Time: time, p2Price: price });
            pendingPointRef.current = null;
            setPendingPoint(null);
          }
        } else if (tool === "fibonacci") {
          const pending = pendingPointRef.current;
          if (!pending) {
            pendingPointRef.current = { time, price };
            setPendingPoint({ time, price });
          } else {
            // Draw Fibonacci levels as price lines
            const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
            const colors  = ["#ef4444","#f97316","#f5a623","#22c55e","#38bdf8","#818cf8","#ef4444"];
            const diff = pending.price - price;
            levels.forEach((lvl, i) => {
              const p = price + diff * lvl;
              addDrawing({ ...base, id: `fib_${Date.now()}_${i}`, type: "hline", price: p, label: `${Math.round(lvl*1000)/10}%`, color: colors[i], lineWidth: 1, lineStyle: 2 });
            });
            pendingPointRef.current = null;
            setPendingPoint(null);
          }
        } else if (tool === "rectangle") {
          const pending = pendingPointRef.current;
          if (!pending) {
            pendingPointRef.current = { time, price };
            setPendingPoint({ time, price });
          } else {
            // Draw rectangle as 2 horizontal lines (top + bottom)
            const topPrice = Math.max(pending.price, price);
            const botPrice = Math.min(pending.price, price);
            addDrawing({ ...base, id: `rect_top_${Date.now()}`, type: "hline", price: topPrice, label: "▲", lineStyle: 0 });
            addDrawing({ ...base, id: `rect_bot_${Date.now()}`, type: "hline", price: botPrice, label: "▼", lineStyle: 0 });
            pendingPointRef.current = null;
            setPendingPoint(null);
          }
        }
      });

      const ro = new ResizeObserver(() => {
        if (el && chartApiRef.current) {
          // Só atualiza largura — altura é fixada no init e nunca muda por teclado ou inputs
          chartApiRef.current.applyOptions({ width: el.clientWidth });
        }
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
  }, [selectedPair, isMobile, windowHeight, chartType]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch wallet data when mobile wallet tab opens ───────────────────────
  useEffect(() => {
    if (!isMobile || mobileTab !== "wallet") return;
    if (walletData) return;
    setWalletLoading(true);
    Promise.all([
      fetch("/api/balance").then(r => r.json()),
      fetch("/api/transactions").then(r => r.json()),
    ]).then(([bal, txs]) => {
      setWalletData({
        balance: bal.balance ?? 0,
        demoBalance: bal.demoBalance ?? 0,
        transactions: Array.isArray(txs) ? txs.slice(0, 8) : [],
      });
      setWalletLoading(false);
    }).catch(() => setWalletLoading(false));
  }, [mobileTab, isMobile, walletData]);

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
        const isWin = unnotified.result === "win";
        setNotification({
          msg:  isWin ? `Win +${formatKz(Math.round(unnotified.profit))}` : `Loss ${formatKz(unnotified.amount)}`,
          type: isWin ? "win" : "loss",
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
      const title = `${t.direction === "call" ? "▲ ALTA" : "▼ BAIXA"}  ${formatKz(t.amount)}`;
      if (tradePriceLinesRef.current.has(t.id)) {
        tradePriceLinesRef.current.get(t.id).applyOptions({ color, title });
      } else if (candleSeriesRef.current) {
        const line = candleSeriesRef.current.createPriceLine({
          price: t.entryPrice,
          color,
          lineWidth: 2,
          lineStyle: 1,
          axisLabelVisible: true,
          title,
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
      line.applyOptions({ color: win ? "#22c55e" : "#ef4444", lineWidth: 2, lineStyle: 1 });
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
        const isWin = t.result === "win";
        setNotification({
          msg:  isWin ? `Win +${formatKz(Math.round(t.profit ?? 0))}` : `Loss ${formatKz(t.amount)}`,
          type: isWin ? "win" : "loss",
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
    // Prevent accidental double-submit (500ms)
    const elapsed = Date.now() - started;
    if (elapsed < 500) await new Promise(r => setTimeout(r, 500 - elapsed));
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
        const btnDisabled = loading || currentPrice === 0;
      return (
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => openTrade("call")} disabled={btnDisabled} style={{
          flex: 1, height: compact ? 52 : 60,
          background: "linear-gradient(135deg,#16a34a 0%,#22c55e 100%)",
          color: "#fff", border: "none", borderRadius: 12,
          fontSize: compact ? 14 : 15, fontWeight: 900,
          cursor: btnDisabled ? "not-allowed" : "pointer",
          opacity: btnDisabled ? 0.6 : 1,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
          boxShadow: btnDisabled ? "none" : "0 4px 16px rgba(34,197,94,0.35)",
          transition: "opacity 0.15s, box-shadow 0.15s",
          letterSpacing: 0.5,
        }}>
          {loading ? "..." : <><TrendingUp size={18} strokeWidth={2.5} /> ALTA</>}
        </button>
        <button onClick={() => openTrade("put")} disabled={btnDisabled} style={{
          flex: 1, height: compact ? 52 : 60,
          background: "linear-gradient(135deg,#b91c1c 0%,#ef4444 100%)",
          color: "#fff", border: "none", borderRadius: 12,
          fontSize: compact ? 14 : 15, fontWeight: 900,
          cursor: btnDisabled ? "not-allowed" : "pointer",
          opacity: btnDisabled ? 0.6 : 1,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
          boxShadow: btnDisabled ? "none" : "0 4px 16px rgba(239,68,68,0.35)",
          transition: "opacity 0.15s, box-shadow 0.15s",
          letterSpacing: 0.5,
        }}>
          {loading ? "..." : <><TrendingDown size={18} strokeWidth={2.5} /> BAIXA</>}
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
    const catOrder  = ["Forex", "Cripto", "Metal", "Índices", "Sintético"];
    const catColors: Record<string, string> = { Forex: "#f5a623", Cripto: "#a78bfa", Metal: "#fcd34d", Índices: "#22c55e", Sintético: "#38bdf8" };
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
  const [indSearch, setIndSearch] = useState("");
  const [indCategory, setIndCategory] = useState<"all"|"trend"|"oscillator">("all");

  function renderIndicatorPanel(compact = false) {
    const toggle = (key: keyof typeof indicators) =>
      setIndicators(p => ({ ...p, [key]: { ...(p[key] as any), enabled: !(p[key] as any).enabled } }));
    const isOn = (key: keyof typeof indicators) => (indicators[key] as any).enabled;

    const INDS: { key: keyof typeof indicators; label: string; color: string; cat: "trend"|"oscillator"; sub?: string }[] = [
      { key: "ma",         label: "Média Móvel (MA)",        color: "#f5a623", cat: "trend",      sub: `Períodos: ${indicators.ma.periods.join(", ")}` },
      { key: "ema",        label: "EMA",                     color: "#a78bfa", cat: "trend",      sub: `Períodos: ${indicators.ema.periods.join(", ")}` },
      { key: "bb",         label: "Bollinger Bands",         color: "#38bdf8", cat: "trend",      sub: `Período ${indicators.bb.period}` },
      { key: "alligator",  label: "Alligator",               color: "#22c55e", cat: "trend" },
      { key: "donchian",   label: "Donchian Channel",        color: "#fbbf24", cat: "trend",      sub: `Período ${indicators.donchian.period}` },
      { key: "keltner",    label: "Keltner Channel",         color: "#c084fc", cat: "trend",      sub: `Período ${indicators.keltner.period}` },
      { key: "sar",        label: "Parabolic SAR",           color: "#f97316", cat: "trend",      sub: `Step ${indicators.sar.step}` },
      { key: "rsi",        label: "RSI",                     color: "#f97316", cat: "oscillator", sub: `Período ${indicators.rsi.period}` },
      { key: "macd",       label: "MACD",                    color: "#22c55e", cat: "oscillator", sub: `${indicators.macd.fast}/${indicators.macd.slow}/${indicators.macd.signal}` },
      { key: "stoch",      label: "Stochastic",              color: "#fb923c", cat: "oscillator", sub: `K${indicators.stoch.kPeriod}/D${indicators.stoch.dPeriod}` },
      { key: "atr",        label: "ATR",                     color: "#fb923c", cat: "oscillator", sub: `Período ${indicators.atr.period}` },
      { key: "cci",        label: "CCI",                     color: "#f43f5e", cat: "oscillator", sub: `Período ${indicators.cci.period}` },
      { key: "willr",      label: "Williams %R",             color: "#818cf8", cat: "oscillator", sub: `Período ${indicators.willr.period}` },
      { key: "momentum",   label: "Momentum",                color: "#2dd4bf", cat: "oscillator", sub: `Período ${indicators.momentum.period}` },
      { key: "ao",         label: "Awesome Oscillator",      color: "#22c55e", cat: "oscillator" },
      { key: "adx",        label: "ADX",                     color: "#f5a623", cat: "oscillator", sub: `Período ${indicators.adx.period}` },
      { key: "bearsbulls", label: "Bears/Bulls Power",       color: "#ef4444", cat: "oscillator", sub: `Período ${indicators.bearsbulls.period}` },
    ];

    const q = indSearch.toLowerCase();
    const filtered = INDS.filter(ind =>
      (indCategory === "all" || ind.cat === indCategory) &&
      (!q || ind.label.toLowerCase().includes(q))
    );

    const activeCount = INDS.filter(i => isOn(i.key)).length;

    // Compact mode: horizontal chip strip (used in timeframe bar)
    if (compact) {
      return (
        <div style={{ background: "#080e1d", borderBottom: "1px solid #1e2d50", padding: "5px 10px", display: "flex", gap: 5, alignItems: "center", overflowX: "auto" }}>
          {INDS.filter(i => isOn(i.key)).map(ind => (
            <button key={ind.key} onClick={() => toggle(ind.key)} style={{
              background: `${ind.color}22`, color: ind.color, border: `1px solid ${ind.color}`,
              borderRadius: 20, padding: "2px 9px", fontSize: 10, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
            }}>✕ {ind.label.split(" ")[0]}</button>
          ))}
          {activeCount === 0 && <span style={{ color: "#334155", fontSize: 10 }}>Nenhum indicador activo</span>}
        </div>
      );
    }

    // Full modal
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 500, display: "flex", alignItems: "flex-end", justifyContent: "flex-end" }}
        onClick={e => { if (e.target === e.currentTarget) setShowIndicators(false); }}>
        <div style={{ width: "min(420px, 100vw)", height: "100vh", background: "#0a0f1e", borderLeft: "1px solid #1e2d50", display: "flex", flexDirection: "column", boxShadow: "-8px 0 32px rgba(0,0,0,0.6)" }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: "1px solid #1e2d50", flexShrink: 0 }}>
            <div>
              <div style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>Indicadores</div>
              {activeCount > 0 && <div style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>{activeCount} activo{activeCount !== 1 ? "s" : ""}</div>}
            </div>
            <button onClick={() => setShowIndicators(false)} style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 8, width: 32, height: 32, color: "#94a3b8", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          </div>

          {/* Search */}
          <div style={{ padding: "10px 18px", borderBottom: "1px solid #1a2540", flexShrink: 0 }}>
            <div style={{ background: "#0d1526", border: "1px solid #1e2d50", borderRadius: 9, display: "flex", alignItems: "center", gap: 8, padding: "7px 12px" }}>
              <span style={{ color: "#334155", fontSize: 13 }}>🔍</span>
              <input value={indSearch} onChange={e => setIndSearch(e.target.value)} placeholder="Pesquisar indicador..."
                style={{ background: "none", border: "none", outline: "none", color: "#e2e8f0", fontSize: 13, width: "100%" }} />
            </div>
          </div>

          {/* Category tabs */}
          <div style={{ display: "flex", padding: "8px 18px", gap: 6, borderBottom: "1px solid #1a2540", flexShrink: 0 }}>
            {(["all", "trend", "oscillator"] as const).map(cat => (
              <button key={cat} onClick={() => setIndCategory(cat)} style={{
                background: indCategory === cat ? "rgba(245,166,35,0.12)" : "transparent",
                color: indCategory === cat ? "#f5a623" : "#64748b",
                border: `1px solid ${indCategory === cat ? "rgba(245,166,35,0.35)" : "#1e2d50"}`,
                borderRadius: 7, padding: "4px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer",
              }}>{{ all: "Todos", trend: "Tendência", oscillator: "Osciladores" }[cat]}</button>
            ))}
          </div>

          {/* Active indicators summary */}
          {activeCount > 0 && (
            <div style={{ padding: "8px 18px", borderBottom: "1px solid #1a2540", display: "flex", flexWrap: "wrap", gap: 5, flexShrink: 0 }}>
              {INDS.filter(i => isOn(i.key)).map(ind => (
                <div key={ind.key} style={{ background: `${ind.color}18`, border: `1px solid ${ind.color}50`, borderRadius: 14, padding: "3px 10px", display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ color: ind.color, fontSize: 11, fontWeight: 700 }}>{ind.label.split(" ")[0]}</span>
                  <button onClick={() => toggle(ind.key)} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 11, padding: 0, lineHeight: 1 }}>✕</button>
                </div>
              ))}
              <button onClick={() => setIndicators(DEFAULT_INDICATORS)} style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 14, padding: "3px 10px", color: "#ef4444", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Limpar tudo</button>
            </div>
          )}

          {/* Indicator list */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {filtered.map(ind => {
              const on = isOn(ind.key);
              return (
                <div key={ind.key} style={{ borderBottom: "1px solid #0d1526" }}>
                  <div style={{ display: "flex", alignItems: "center", padding: "12px 18px", gap: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: `${ind.color}18`, border: `1px solid ${ind.color}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ width: 14, height: 3, borderRadius: 2, background: ind.color, display: "block" }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: on ? "#fff" : "#94a3b8", fontWeight: on ? 700 : 500, fontSize: 13 }}>{ind.label}</div>
                      {on && ind.sub && <div style={{ color: "#64748b", fontSize: 11, marginTop: 1 }}>{ind.sub}</div>}
                    </div>
                    {/* Toggle */}
                    <button onClick={() => toggle(ind.key)} style={{
                      width: 40, height: 22, borderRadius: 11, border: "none", cursor: "pointer", position: "relative", flexShrink: 0,
                      background: on ? "#f5a623" : "#1e2d50", transition: "background 0.2s",
                    }}>
                      <span style={{ position: "absolute", top: 3, left: on ? 21 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
                    </button>
                  </div>

                  {/* Inline settings when active */}
                  {on && (
                    <div style={{ padding: "0 18px 12px", display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {ind.key === "ma" && ([9, 20, 50] as const).map(p => (
                        <button key={p} onClick={() => setIndicators(prev => {
                          const has = prev.ma.periods.includes(p);
                          const periods = has ? prev.ma.periods.filter(x => x !== p) : [...prev.ma.periods, p];
                          return { ...prev, ma: { ...prev.ma, periods: periods.length ? periods : [p] } };
                        })} style={{ background: indicators.ma.periods.includes(p) ? `${MA_COLORS[p]}30` : "#0d1526", color: indicators.ma.periods.includes(p) ? MA_COLORS[p] : "#64748b", border: `1px solid ${indicators.ma.periods.includes(p) ? MA_COLORS[p] : "#1e2d50"}`, borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                          MA {p}
                        </button>
                      ))}
                      {ind.key === "ema" && ([9, 20, 50] as const).map(p => (
                        <button key={p} onClick={() => setIndicators(prev => {
                          const has = prev.ema.periods.includes(p);
                          const periods = has ? prev.ema.periods.filter(x => x !== p) : [...prev.ema.periods, p];
                          return { ...prev, ema: { ...prev.ema, periods: periods.length ? periods : [p] } };
                        })} style={{ background: indicators.ema.periods.includes(p) ? `${EMA_COLORS[p]}30` : "#0d1526", color: indicators.ema.periods.includes(p) ? EMA_COLORS[p] : "#64748b", border: `1px solid ${indicators.ema.periods.includes(p) ? EMA_COLORS[p] : "#1e2d50"}`, borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                          EMA {p}
                        </button>
                      ))}
                      {(["bb", "donchian", "atr", "cci", "willr", "momentum"] as const).includes(ind.key as any) && (
                        <label style={{ display: "flex", alignItems: "center", gap: 6, color: "#64748b", fontSize: 11 }}>
                          Período
                          <input type="number" min={2} max={200}
                            value={(indicators[ind.key] as any).period}
                            onChange={e => setIndicators(p => ({ ...p, [ind.key]: { ...(p[ind.key] as any), period: Math.max(2, parseInt(e.target.value)||14) } }))}
                            style={{ width: 52, background: "#0d1526", border: "1px solid #1e2d50", borderRadius: 5, color: "#f5a623", fontSize: 11, padding: "3px 7px", outline: "none", textAlign: "center" }} />
                        </label>
                      )}
                      {ind.key === "stoch" && (<>
                        <label style={{ display: "flex", alignItems: "center", gap: 5, color: "#64748b", fontSize: 11 }}>K <input type="number" min={2} max={50} value={indicators.stoch.kPeriod} onChange={e => setIndicators(p => ({ ...p, stoch: { ...p.stoch, kPeriod: Math.max(2, parseInt(e.target.value)||14) } }))} style={{ width: 44, background: "#0d1526", border: "1px solid #1e2d50", borderRadius: 5, color: "#f5a623", fontSize: 11, padding: "3px 6px", outline: "none", textAlign: "center" }} /></label>
                        <label style={{ display: "flex", alignItems: "center", gap: 5, color: "#64748b", fontSize: 11 }}>D <input type="number" min={2} max={20} value={indicators.stoch.dPeriod} onChange={e => setIndicators(p => ({ ...p, stoch: { ...p.stoch, dPeriod: Math.max(2, parseInt(e.target.value)||3) } }))} style={{ width: 44, background: "#0d1526", border: "1px solid #1e2d50", borderRadius: 5, color: "#f5a623", fontSize: 11, padding: "3px 6px", outline: "none", textAlign: "center" }} /></label>
                      </>)}
                      {ind.key === "macd" && (<>
                        <label style={{ display: "flex", alignItems: "center", gap: 5, color: "#64748b", fontSize: 11 }}>Fast <input type="number" min={2} value={indicators.macd.fast} onChange={e => setIndicators(p => ({ ...p, macd: { ...p.macd, fast: Math.max(2, parseInt(e.target.value)||12) } }))} style={{ width: 44, background: "#0d1526", border: "1px solid #1e2d50", borderRadius: 5, color: "#f5a623", fontSize: 11, padding: "3px 6px", outline: "none", textAlign: "center" }} /></label>
                        <label style={{ display: "flex", alignItems: "center", gap: 5, color: "#64748b", fontSize: 11 }}>Slow <input type="number" min={2} value={indicators.macd.slow} onChange={e => setIndicators(p => ({ ...p, macd: { ...p.macd, slow: Math.max(2, parseInt(e.target.value)||26) } }))} style={{ width: 44, background: "#0d1526", border: "1px solid #1e2d50", borderRadius: 5, color: "#f5a623", fontSize: 11, padding: "3px 6px", outline: "none", textAlign: "center" }} /></label>
                      </>)}
                      {ind.key === "rsi" && (
                        <label style={{ display: "flex", alignItems: "center", gap: 6, color: "#64748b", fontSize: 11 }}>
                          Período
                          <input type="number" min={2} max={100} value={indicators.rsi.period} onChange={e => setIndicators(p => ({ ...p, rsi: { ...p.rsi, period: Math.max(2, parseInt(e.target.value)||14) } }))} style={{ width: 52, background: "#0d1526", border: "1px solid #1e2d50", borderRadius: 5, color: "#f5a623", fontSize: 11, padding: "3px 7px", outline: "none", textAlign: "center" }} />
                        </label>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── Left sidebar + Quotex-style slide-in panel ──────────────────────────────

  function renderLeftSidebar() {
    const CHART_TYPES: { id: ChartType; icon: React.ReactNode; label: string }[] = [
      { id: "candle", icon: <CandlestickChart size={15} />, label: "Candlestick" },
      { id: "line",   icon: <LineChart size={15} />,        label: "Linha" },
      { id: "area",   icon: <AreaChart size={15} />,        label: "Área" },
      { id: "bar",    icon: <BarChart size={15} />,         label: "Barra" },
    ];
    const sBtn = (active: boolean, onClick: () => void, icon: React.ReactNode, label: string, badge?: number) => (
      <button title={label} onClick={onClick} style={{
        position: "relative", width: 36, height: 36,
        background: active ? "rgba(245,166,35,0.15)" : "transparent",
        border: active ? "1px solid rgba(245,166,35,0.4)" : "1px solid transparent",
        borderRadius: 8, color: active ? "#f5a623" : "#64748b", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s",
      }}>
        {icon}
        {badge != null && badge > 0 && (
          <span style={{ position: "absolute", top: 2, right: 2, background: "#f5a623", color: "#0a0f1e", borderRadius: "50%", width: 13, height: 13, fontSize: 8, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>{badge}</span>
        )}
      </button>
    );

    const activeDrawings = drawings.length;
    const activeInds = Object.values(indicators).filter((v: any) => v.enabled).length;

    return (
      <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 44, zIndex: 30, background: "#070d1c", borderRight: "1px solid #1a2540", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 10, paddingBottom: 10, gap: 3 }}>

        {sBtn(leftPanel === "drawings",    () => setLeftPanel(p => p === "drawings"    ? null : "drawings"),    <PenLine size={15} />,  "Ferramentas de Desenho", activeDrawings)}
        <div style={{ width: 24, height: 1, background: "#1a2540", margin: "3px 0" }} />
        {sBtn(leftPanel === "indicators",  () => setLeftPanel(p => p === "indicators"  ? null : "indicators"),  <Activity size={15} />, "Indicadores", activeInds)}
        <div style={{ width: 24, height: 1, background: "#1a2540", margin: "3px 0" }} />

        {/* Chart type */}
        <div style={{ position: "relative" }}>
          {sBtn(expandedItem === "__charttype", () => setExpandedItem(p => p === "__charttype" ? null : "__charttype"),
            CHART_TYPES.find(t => t.id === chartType)?.icon ?? <CandlestickChart size={15} />, "Tipo de Gráfico")}
          {expandedItem === "__charttype" && (
            <div style={{ position: "absolute", left: 42, top: 0, background: "#0d1526", border: "1px solid #1e2d50", borderRadius: 10, padding: 5, display: "flex", flexDirection: "column", gap: 2, zIndex: 200, minWidth: 148, boxShadow: "4px 4px 24px rgba(0,0,0,0.6)" }}>
              {CHART_TYPES.map(ct => (
                <button key={ct.id} onClick={() => { setChartType(ct.id); setExpandedItem(null); }} style={{
                  background: chartType === ct.id ? "rgba(245,166,35,0.12)" : "transparent",
                  color: chartType === ct.id ? "#f5a623" : "#94a3b8",
                  border: "none", borderRadius: 7, padding: "7px 12px", cursor: "pointer",
                  fontSize: 12, fontWeight: chartType === ct.id ? 700 : 400,
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  <span style={{ color: chartType === ct.id ? "#f5a623" : "#64748b" }}>{ct.icon}</span>
                  {ct.label}
                  {chartType === ct.id && <span style={{ marginLeft: "auto", color: "#f5a623", fontSize: 13 }}>✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ flex: 1 }} />
        {sBtn(false, () => {
          const el = document.documentElement;
          if (!document.fullscreenElement) el.requestFullscreen?.();
          else document.exitFullscreen?.();
        }, <Maximize2 size={14} />, "Ecrã inteiro")}
      </div>
    );
  }

  function renderSlideInPanel() {
    if (!leftPanel) return null;

    const IND_ICON = (color: string) => <div style={{ width: 14, height: 2, borderRadius: 2, background: color }} />;
    const OSC_ICON = (color: string) => <BarChart2 size={13} style={{ color }} />;
    const INDICATOR_LIST = [
      { section: "TENDÊNCIA", items: [
        { key: "ma",        label: "Média Móvel (MA/EMA/WMA)", icon: IND_ICON("#f5a623") },
        { key: "bb",        label: "Bollinger Bands",          icon: IND_ICON("#38bdf8") },
        { key: "alligator", label: "Alligator",                icon: IND_ICON("#22c55e") },
        { key: "donchian",  label: "Donchian Channel",         icon: IND_ICON("#fbbf24") },
        { key: "keltner",   label: "Keltner Channel",          icon: IND_ICON("#c084fc") },
        { key: "sar",       label: "Parabolic SAR",            icon: IND_ICON("#f97316") },
        { key: "ichimoku",  label: "Ichimoku Cloud",  soon: true, icon: IND_ICON("#64748b") },
        { key: "supertrend",label: "Supertrend",      soon: true, icon: IND_ICON("#64748b") },
        { key: "fractal",   label: "Fractal",         soon: true, icon: IND_ICON("#64748b") },
        { key: "zigzag",    label: "Zig Zag",         soon: true, icon: IND_ICON("#64748b") },
      ]},
      { section: "OSCILADORES", items: [
        { key: "rsi",        label: "RSI",                icon: OSC_ICON("#f97316") },
        { key: "macd",       label: "MACD",               icon: OSC_ICON("#22c55e") },
        { key: "stoch",      label: "Stochastic",         icon: OSC_ICON("#fb923c") },
        { key: "atr",        label: "ATR",                icon: OSC_ICON("#fb923c") },
        { key: "cci",        label: "CCI",                icon: OSC_ICON("#f43f5e") },
        { key: "adx",        label: "ADX",                icon: OSC_ICON("#f5a623") },
        { key: "willr",      label: "Williams %R",        icon: OSC_ICON("#818cf8") },
        { key: "momentum",   label: "Momentum",           icon: OSC_ICON("#2dd4bf") },
        { key: "ao",         label: "Awesome Oscillator", icon: OSC_ICON("#22c55e") },
        { key: "bearsbulls", label: "Bears/Bulls Power",  icon: OSC_ICON("#ef4444") },
        { key: "aroon",      label: "Aroon",          soon: true, icon: OSC_ICON("#64748b") },
        { key: "roc",        label: "Rate of Change", soon: true, icon: OSC_ICON("#64748b") },
        { key: "stc",        label: "Schaff Trend",   soon: true, icon: OSC_ICON("#64748b") },
        { key: "vortex",     label: "Vortex",         soon: true, icon: OSC_ICON("#64748b") },
        { key: "demarker",   label: "DeMarker",       soon: true, icon: OSC_ICON("#64748b") },
        { key: "volume_osc", label: "Volume Oscillator", soon: true, icon: OSC_ICON("#64748b") },
        { key: "weis",       label: "Weis Waves",     soon: true, icon: OSC_ICON("#64748b") },
      ]},
    ];

    const DRAWING_LIST = [
      { section: "FERRAMENTAS", items: [
        { key: "hline",     label: "Linha Horizontal",       icon: <Minus size={13} /> },
        { key: "trendline", label: "Linha de Tendência",     icon: <TrendingUp size={13} /> },
        { key: "fibonacci", label: "Fibonacci Retracement",  icon: <GitFork size={13} /> },
        { key: "rectangle", label: "Rectângulo",             icon: <Square size={13} /> },
        { key: "vline",     label: "Linha Vertical",         icon: <Minus size={13} style={{ transform: "rotate(90deg)" }} />, soon: true },
        { key: "ray",       label: "Ray",                    icon: <TrendingUp size={13} />, soon: true },
        { key: "extline",   label: "Extended Line",          icon: <Activity size={13} />, soon: true },
        { key: "channel",   label: "Parallel Channel",       icon: <Sliders size={13} />, soon: true },
        { key: "pitchfork", label: "Pitchfork",              icon: <GitFork size={13} />, soon: true },
        { key: "fibfan",    label: "Fibonacci Fan",          icon: <GitFork size={13} />, soon: true },
        { key: "gannbox",   label: "Gann Box",               icon: <Square size={13} />, soon: true },
        { key: "triangle",  label: "Triângulo",              icon: <Square size={13} />, soon: true },
        { key: "arc",       label: "Arco",                   icon: <Activity size={13} />, soon: true },
        { key: "daterange", label: "Date Range",             icon: <Clock size={13} />, soon: true },
        { key: "pricerange",label: "Price Range",            icon: <BarChart2 size={13} />, soon: true },
      ]},
    ];

    const isIndOn = (key: string) => key in indicators ? (indicators[key as keyof typeof indicators] as any).enabled : false;
    const toggleInd = (key: string) => {
      if (key in indicators) setIndicators(p => ({ ...p, [key]: { ...(p[key as keyof typeof indicators] as any), enabled: !(p[key as keyof typeof indicators] as any).enabled } }));
    };

    const list = leftPanel === "indicators" ? INDICATOR_LIST : DRAWING_LIST;
    const title = leftPanel === "indicators" ? "Indicadores" : "Ferramentas";

    const activeInds = leftPanel === "indicators" ? Object.keys(indicators).filter(k => (indicators[k as keyof typeof indicators] as any).enabled) : drawings.map(d => d.id);
    const activeCount = activeInds.length;

    // Render settings fields for an indicator
    const renderIndSettings = (key: string) => {
      const cfg = pendingCfg[key] ?? {};
      const field = (label: string, fkey: string, placeholder: string, type = "number") => (
        <label key={fkey} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ color: "#64748b", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</span>
          <input type={type} placeholder={placeholder} value={cfg[fkey] ?? ""} onChange={e => setPendingCfg(p => ({ ...p, [key]: { ...(p[key] ?? {}), [fkey]: e.target.value } }))}
            style={{ background: "#0a0f1e", border: "1px solid #1e2d50", borderRadius: 6, color: "#e2e8f0", fontSize: 12, padding: "5px 9px", outline: "none", width: "100%" }} />
        </label>
      );
      const colorField = (label: string, fkey: string, def: string) => (
        <label key={fkey} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ color: "#64748b", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</span>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="color" value={cfg[fkey] ?? def} onChange={e => setPendingCfg(p => ({ ...p, [key]: { ...(p[key] ?? {}), [fkey]: e.target.value } }))}
              style={{ width: 28, height: 24, border: "none", borderRadius: 4, cursor: "pointer", background: "transparent" }} />
            <span style={{ color: "#64748b", fontSize: 11 }}>{cfg[fkey] ?? def}</span>
          </div>
        </label>
      );
      const applyBtn = (onApply: () => void) => (
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <button onClick={onApply} style={{ flex: 1, background: "rgba(245,166,35,0.15)", border: "1px solid rgba(245,166,35,0.3)", borderRadius: 7, color: "#f5a623", fontSize: 11, fontWeight: 700, padding: "6px 0", cursor: "pointer" }}>Aplicar</button>
          <button onClick={() => setPendingCfg(p => ({ ...p, [key]: {} }))} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid #1e2d50", borderRadius: 7, color: "#64748b", fontSize: 11, padding: "6px 10px", cursor: "pointer" }}>Reset</button>
        </div>
      );

      const fields: Record<string, React.ReactElement[]> = {
        ma: [field("Período", "period", "ex: 20"), field("Tipo", "type", "SMA/EMA/WMA", "text"), colorField("Cor", "color", "#f5a623")],
        bb: [field("Período", "period", "ex: 20"), field("Desvio padrão", "mult", "ex: 2"), colorField("Cor superior", "colorUp", "#38bdf8"), colorField("Cor inferior", "colorDn", "#38bdf8")],
        alligator: [field("Período Jaw", "jaw", "ex: 13"), field("Período Teeth", "teeth", "ex: 8"), field("Período Lips", "lips", "ex: 5"), colorField("Cor Jaw", "colorJaw", "#3b82f6"), colorField("Cor Teeth", "colorTeeth", "#ef4444"), colorField("Cor Lips", "colorLips", "#22c55e")],
        donchian: [field("Período", "period", "ex: 20"), colorField("Cor superior", "colorUp", "#fbbf24"), colorField("Cor inferior", "colorDn", "#fbbf24")],
        keltner: [field("Período", "period", "ex: 20"), field("Multiplicador", "mult", "ex: 2"), colorField("Cor", "color", "#c084fc")],
        sar: [field("Step", "step", "ex: 0.02"), field("Maximum", "max", "ex: 0.2"), colorField("Cor", "color", "#f97316")],
        rsi: [field("Período", "period", "ex: 14"), field("Sobrecompra", "ob", "ex: 70"), field("Sobrevenda", "os", "ex: 30"), colorField("Cor", "color", "#f97316")],
        macd: [field("Fast", "fast", "ex: 12"), field("Slow", "slow", "ex: 26"), field("Signal", "signal", "ex: 9"), colorField("Cor MACD", "colorMacd", "#22c55e"), colorField("Cor Signal", "colorSig", "#ef4444")],
        stoch: [field("Período K", "kp", "ex: 14"), field("Período D", "dp", "ex: 3"), field("Sobrecompra", "ob", "ex: 80"), field("Sobrevenda", "os", "ex: 20"), colorField("Cor K", "colorK", "#22d3ee"), colorField("Cor D", "colorD", "#f59e0b")],
        atr: [field("Período", "period", "ex: 14"), colorField("Cor", "color", "#fb923c")],
        cci: [field("Período", "period", "ex: 20"), field("Sobrecompra", "ob", "ex: 100"), field("Sobrevenda", "os", "ex: -100"), colorField("Cor", "color", "#f43f5e")],
        adx: [field("Período", "period", "ex: 14"), field("Nível ref.", "level", "ex: 25"), colorField("Cor ADX", "colorAdx", "#f5a623"), colorField("Cor +DI", "colorPlus", "#22c55e"), colorField("Cor -DI", "colorMinus", "#ef4444")],
        willr: [field("Período", "period", "ex: 14"), field("Sobrecompra", "ob", "ex: -20"), field("Sobrevenda", "os", "ex: -80"), colorField("Cor", "color", "#818cf8")],
        momentum: [field("Período", "period", "ex: 10"), colorField("Cor", "color", "#2dd4bf")],
        ao: [colorField("Cor positiva", "colorPos", "#22c55e"), colorField("Cor negativa", "colorNeg", "#ef4444")],
        bearsbulls: [field("Período", "period", "ex: 13"), colorField("Bears", "colorBear", "#ef4444"), colorField("Bulls", "colorBull", "#22c55e")],
      };

      const getApply = (k: string) => () => {
        const c = pendingCfg[k] ?? {};
        const num = (v: any, def: number) => { const n = parseFloat(v); return isFinite(n) && n > 0 ? n : def; };
        const updates: Partial<typeof indicators> = {};
        if (k === "ma" || k === "ema") {
          const period = num(c.period, 20);
          (updates as any)[k] = { ...indicators[k as "ma"], enabled: true, periods: [period] };
        } else if (k === "bb") (updates as any).bb = { ...indicators.bb, enabled: true, period: num(c.period, 20), mult: num(c.mult, 2) };
        else if (k === "donchian") (updates as any).donchian = { ...indicators.donchian, enabled: true, period: num(c.period, 20) };
        else if (k === "keltner") (updates as any).keltner = { ...indicators.keltner, enabled: true, period: num(c.period, 20), mult: num(c.mult, 2) };
        else if (k === "sar") (updates as any).sar = { ...indicators.sar, enabled: true, step: num(c.step, 0.02), max: num(c.max, 0.2) };
        else if (k === "rsi") (updates as any).rsi = { ...indicators.rsi, enabled: true, period: num(c.period, 14) };
        else if (k === "macd") (updates as any).macd = { ...indicators.macd, enabled: true, fast: num(c.fast, 12), slow: num(c.slow, 26), signal: num(c.signal, 9) };
        else if (k === "stoch") (updates as any).stoch = { ...indicators.stoch, enabled: true, kPeriod: num(c.kp, 14), dPeriod: num(c.dp, 3) };
        else if (k === "atr") (updates as any).atr = { ...indicators.atr, enabled: true, period: num(c.period, 14) };
        else if (k === "cci") (updates as any).cci = { ...indicators.cci, enabled: true, period: num(c.period, 20) };
        else if (k === "adx") (updates as any).adx = { ...indicators.adx, enabled: true, period: num(c.period, 14) };
        else if (k === "willr") (updates as any).willr = { ...indicators.willr, enabled: true, period: num(c.period, 14) };
        else if (k === "momentum") (updates as any).momentum = { ...indicators.momentum, enabled: true, period: num(c.period, 10) };
        else if (k === "alligator" || k === "ao" || k === "bearsbulls") (updates as any)[k] = { ...(indicators[k as keyof typeof indicators] as any), enabled: true };
        setIndicators(p => ({ ...p, ...updates }));
        setExpandedItem(null);
      };

      const fList = fields[key];
      if (!fList) return null;
      return (
        <div style={{ padding: "10px 16px 14px", background: "#070d1c", borderTop: "1px solid #1a2540", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{fList}</div>
          {applyBtn(getApply(key))}
        </div>
      );
    };

    // Render settings for a drawing tool
    const renderDrawingSettings = (key: string) => {
      const cfg = pendingCfg[`draw_${key}`] ?? {};
      const setD = (f: string, v: any) => setPendingCfg(p => ({ ...p, [`draw_${key}`]: { ...(p[`draw_${key}`] ?? {}), [f]: v } }));
      return (
        <div style={{ padding: "10px 16px 14px", background: "#070d1c", borderTop: "1px solid #1a2540", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={{ color: "#64748b", fontSize: 10, fontWeight: 600, textTransform: "uppercase" }}>Cor</span>
              <input type="color" value={cfg.color ?? toolColor} onChange={e => { setD("color", e.target.value); setToolColor(e.target.value); }}
                style={{ width: "100%", height: 26, border: "none", borderRadius: 5, cursor: "pointer", background: "transparent" }} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={{ color: "#64748b", fontSize: 10, fontWeight: 600, textTransform: "uppercase" }}>Espessura</span>
              <div style={{ display: "flex", gap: 4 }}>
                {[1,2,3].map(w => <button key={w} onClick={() => { setD("width", w); setToolLineWidth(w); }} style={{ flex: 1, background: toolLineWidth === w ? "rgba(245,166,35,0.15)" : "#0d1526", border: `1px solid ${toolLineWidth === w ? "#f5a623" : "#1e2d50"}`, borderRadius: 5, color: toolLineWidth === w ? "#f5a623" : "#64748b", fontSize: 11, padding: "4px 0", cursor: "pointer" }}>{w}px</button>)}
              </div>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={{ color: "#64748b", fontSize: 10, fontWeight: 600, textTransform: "uppercase" }}>Estilo</span>
              <div style={{ display: "flex", gap: 4 }}>
                {[["───",0],["---",1],["···",2]].map(([l,s]) => <button key={s} onClick={() => { setD("style", s); setToolLineStyle(s as number); }} style={{ flex: 1, background: toolLineStyle === s ? "rgba(245,166,35,0.15)" : "#0d1526", border: `1px solid ${toolLineStyle === s ? "#f5a623" : "#1e2d50"}`, borderRadius: 5, color: toolLineStyle === s ? "#f5a623" : "#64748b", fontSize: 9, padding: "4px 0", cursor: "pointer" }}>{l}</button>)}
              </div>
            </label>
          </div>
          <p style={{ color: "#334155", fontSize: 11, textAlign: "center" }}>
            Clica no gráfico para começar a desenhar
          </p>
        </div>
      );
    };

    return (
      <div style={isMobile
        ? { position: "fixed", top: 0, left: 0, right: 0, bottom: 52, zIndex: 200, background: "#0a0f1e", display: "flex", flexDirection: "column", overflow: "hidden" }
        : { position: "absolute", top: 0, left: 44, width: 320, height: "100%", zIndex: 25, background: "#0a0f1e", borderRight: "1px solid #1e2d50", display: "flex", flexDirection: "column", boxShadow: "4px 0 24px rgba(0,0,0,0.5)", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid #1e2d50", flexShrink: 0, background: "#080e1d" }}>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 14 }}>{title}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {activeCount > 0 && <span style={{ background: "rgba(245,166,35,0.15)", color: "#f5a623", borderRadius: 10, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>{activeCount}</span>}
            <button onClick={() => setLeftPanel(null)} style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 6, width: 26, height: 26, color: "#94a3b8", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          </div>
        </div>

        {/* Active drawings list (only in drawings panel) */}
        {leftPanel === "drawings" && drawings.length > 0 && (
          <div style={{ borderBottom: "1px solid #1a2540", flexShrink: 0 }}>
            <div style={{ padding: "8px 16px 5px", fontSize: 10, fontWeight: 700, color: "#334155", letterSpacing: 1.2, textTransform: "uppercase" }}>NO GRÁFICO ({drawings.length})</div>
            <div style={{ maxHeight: 160, overflowY: "auto" }}>
              {/* Group fibonacci and rectangle sets */}
              {(() => {
                type Group = { ids: string[]; label: string; color: string; icon: React.ReactNode };
                const groups: Group[] = [];
                const used = new Set<string>();
                drawings.forEach(d => {
                  if (used.has(d.id)) return;
                  if (d.id.startsWith("fib_")) {
                    const prefix = d.id.replace(/_\d+$/, "").replace(/fib_(\d+)_\d+/, "fib_$1");
                    const siblings = drawings.filter(x => x.id.startsWith(`fib_${d.id.split("_")[1]}`));
                    siblings.forEach(s => used.add(s.id));
                    groups.push({ ids: siblings.map(s => s.id), label: `Fibonacci (${siblings.length} níveis)`, color: (d as any).color ?? "#f5a623", icon: <GitFork size={11} /> });
                  } else if (d.id.startsWith("rect_top_") || d.id.startsWith("rect_bot_")) {
                    const ts = d.id.replace("rect_top_","").replace("rect_bot_","");
                    const pair = drawings.filter(x => x.id === `rect_top_${ts}` || x.id === `rect_bot_${ts}`);
                    pair.forEach(s => used.add(s.id));
                    groups.push({ ids: pair.map(s => s.id), label: "Rectângulo", color: d.color, icon: <Square size={11} /> });
                  } else if (d.type === "hline") {
                    used.add(d.id);
                    const hl = d as HLineDrawing;
                    groups.push({ ids: [d.id], label: hl.label ? `Linha — ${hl.label}` : `Linha H ${hl.price.toFixed(4)}`, color: d.color, icon: <Minus size={11} /> });
                  } else if (d.type === "trendline") {
                    used.add(d.id);
                    groups.push({ ids: [d.id], label: "Linha de Tendência", color: d.color, icon: <TrendingUp size={11} /> });
                  }
                });
                return groups.map((g, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", padding: "7px 16px", borderBottom: "1px solid #0a0f18", gap: 9 }}>
                    <span style={{ color: g.color, flexShrink: 0 }}>{g.icon}</span>
                    <span style={{ flex: 1, color: "#94a3b8", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.label}</span>
                    <button onClick={() => g.ids.forEach(id => removeDrawing(id))} title="Apagar" style={{ background: "none", border: "none", color: "#4b5563", cursor: "pointer", padding: "2px 4px", display: "flex", alignItems: "center", flexShrink: 0, borderRadius: 4, transition: "color 0.15s" }}
                      onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")}
                      onMouseLeave={e => (e.currentTarget.style.color = "#4b5563")}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                ));
              })()}
            </div>
          </div>
        )}

        {/* Scrollable list */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {list.map(section => (
            <div key={section.section}>
              <div style={{ padding: "10px 16px 6px", fontSize: 10, fontWeight: 700, color: "#334155", letterSpacing: 1.2, textTransform: "uppercase" }}>{section.section}</div>
              {section.items.map((item: any) => {
                const isActive = leftPanel === "indicators" ? isIndOn(item.key) : (activeTool === item.key);
                const isExp = expandedItem === item.key;
                return (
                  <div key={item.key} style={{ borderBottom: "1px solid #0d1526" }}>
                    <button onClick={() => {
                      if (item.soon) return;
                      if (leftPanel === "drawings") {
                        // Toggle: if already active tool, deactivate; else activate immediately
                        if (activeTool === item.key) {
                          setActiveTool(null); setPendingPoint(null); pendingPointRef.current = null;
                        } else {
                          setActiveTool(item.key as DrawingTool);
                          setPendingPoint(null); pendingPointRef.current = null;
                        }
                        setExpandedItem(p => p === item.key ? null : item.key);
                      } else {
                        setExpandedItem(p => p === item.key ? null : item.key);
                      }
                    }} style={{ width: "100%", display: "flex", alignItems: "center", padding: "11px 16px", background: isActive ? "rgba(245,166,35,0.04)" : "transparent", border: "none", cursor: item.soon ? "default" : "pointer", textAlign: "left", gap: 10 }}>
                      <div style={{ width: 22, height: 22, borderRadius: 6, background: isActive ? "rgba(245,166,35,0.15)" : "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", color: isActive ? "#f5a623" : "#64748b", flexShrink: 0 }}>
                        {(item as any).icon ?? <div style={{ width: 6, height: 6, borderRadius: "50%", background: isActive ? "#f5a623" : "#1e2d50" }} />}
                      </div>
                      <span style={{ flex: 1, color: isActive ? "#fff" : item.soon ? "#334155" : "#94a3b8", fontSize: 13, fontWeight: isActive ? 700 : 400 }}>{item.label}</span>
                      {item.soon && <span style={{ background: "rgba(100,116,139,0.1)", color: "#334155", borderRadius: 4, padding: "1px 6px", fontSize: 9, fontWeight: 600 }}>EM BREVE</span>}
                      {isActive && leftPanel === "indicators" && !item.soon && (
                        <button onClick={e => { e.stopPropagation(); setIndicators(p => ({ ...p, [item.key]: { ...(p[item.key as keyof typeof indicators] as any), enabled: false } })); }} style={{ background: "rgba(239,68,68,0.1)", border: "none", borderRadius: 4, color: "#ef4444", fontSize: 10, cursor: "pointer", padding: "2px 6px", flexShrink: 0 }}>✕</button>
                      )}
                      {!item.soon && <span style={{ color: "#334155", fontSize: 12 }}>{isExp ? "⌃" : "⌄"}</span>}
                    </button>
                    {isExp && !item.soon && (
                      leftPanel === "indicators" ? renderIndSettings(item.key) : renderDrawingSettings(item.key)
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {/* Delete all */}
          {activeCount > 0 && (
            <div style={{ padding: 14 }}>
              <button onClick={() => {
                if (leftPanel === "indicators") setIndicators(DEFAULT_INDICATORS);
                else clearAllDrawings();
              }} style={{ width: "100%", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, color: "#ef4444", fontSize: 12, fontWeight: 700, padding: "9px 0", cursor: "pointer" }}>
                🗑️ Apagar tudo
              </button>
            </div>
          )}
        </div>
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

  // ── Drawing tools panel ───────────────────────────────────────────────────
  function renderDrawingToolsPanel(compact = false) {
    const toolBtn = (id: DrawingTool, icon: string, label: string) => {
      const active = activeTool === id;
      return (
        <button key={id ?? "none"} onClick={() => {
          if (active) { setActiveTool(null); setPendingPoint(null); pendingPointRef.current = null; }
          else { setActiveTool(id); setPendingPoint(null); pendingPointRef.current = null; }
        }} title={label} style={{
          display: "flex", alignItems: "center", gap: 4,
          background: active ? "rgba(245,166,35,0.15)" : "transparent",
          color: active ? "#f5a623" : "#64748b",
          border: `1px solid ${active ? "rgba(245,166,35,0.5)" : "#1e2d50"}`,
          borderRadius: 7, padding: compact ? "3px 8px" : "4px 10px",
          fontSize: compact ? 10 : 11, fontWeight: 700, cursor: "pointer",
          boxShadow: active ? "0 0 8px rgba(245,166,35,0.3)" : "none",
          transition: "all 0.13s", whiteSpace: "nowrap", flexShrink: 0,
        }}>
          <span style={{ fontSize: compact ? 11 : 13 }}>{icon}</span>
          {!compact && <span>{label}</span>}
        </button>
      );
    };

    const dec = selectedPair?.decimals ?? 5;

    return (
      <div style={{ background: "#06091a", borderBottom: "1px solid #1e2d50", padding: compact ? "5px 8px" : "7px 14px", display: "flex", flexDirection: "column", gap: compact ? 4 : 6 }}>

        {/* Row 1: Tools + colour + style */}
        <div style={{ display: "flex", gap: compact ? 4 : 6, alignItems: "center", flexWrap: "nowrap", overflowX: "auto" }}>

          {/* Tool buttons */}
          {toolBtn("hline",     "─",  "Linha Horizontal")}
          {toolBtn("trendline", "╱",  "Linha de Tendência")}
          {toolBtn("fibonacci", "φ",  "Fibonacci")}
          {toolBtn("rectangle", "▭",  "Rectângulo")}

          {/* Pending point indicator */}
          {pendingPoint && (
            <span style={{ fontSize: 10, color: "#f5a623", background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.3)", borderRadius: 6, padding: "2px 7px", flexShrink: 0 }}>
              1º ponto: {pendingPoint.price.toFixed(dec)} — clique no 2º ponto (Esc cancela)
            </span>
          )}

          <div style={{ flex: 1 }} />

          {/* Colour palette */}
          <div style={{ display: "flex", gap: 3, alignItems: "center", flexShrink: 0 }}>
            {TOOL_COLORS.map(c => (
              <button key={c} onClick={() => setToolColor(c)} style={{
                width: compact ? 14 : 16, height: compact ? 14 : 16, borderRadius: "50%", background: c, border: toolColor === c ? "2px solid #fff" : "2px solid transparent",
                cursor: "pointer", padding: 0, flexShrink: 0,
              }} />
            ))}
          </div>

          <div style={{ width: 1, height: 18, background: "#1e2d50", flexShrink: 0 }} />

          {/* Line style */}
          {[0, 1, 2].map(s => (
            <button key={s} onClick={() => setToolLineStyle(s)} style={{
              background: toolLineStyle === s ? "rgba(255,255,255,0.1)" : "transparent",
              color: toolLineStyle === s ? "#e2e8f0" : "#4b5563",
              border: `1px solid ${toolLineStyle === s ? "#4b5563" : "#1e2d50"}`,
              borderRadius: 5, padding: "2px 7px", fontSize: 9, fontWeight: 700, cursor: "pointer", flexShrink: 0,
            }}>{["───","---","···"][s]}</button>
          ))}

          {/* Line width */}
          {[1, 2, 3].map(w => (
            <button key={w} onClick={() => setToolLineWidth(w)} style={{
              background: toolLineWidth === w ? "rgba(255,255,255,0.1)" : "transparent",
              color: toolLineWidth === w ? "#e2e8f0" : "#4b5563",
              border: `1px solid ${toolLineWidth === w ? "#4b5563" : "#1e2d50"}`,
              borderRadius: 5, padding: "2px 7px", fontSize: 9, fontWeight: 700, cursor: "pointer", flexShrink: 0,
              borderBottom: `${w + 1}px solid ${toolLineWidth === w ? "#e2e8f0" : "#4b5563"}`,
            }}>{w}</button>
          ))}

          {/* Label input (only for hline) */}
          {activeTool === "hline" && (
            <input value={toolLabel} onChange={e => setToolLabel(e.target.value)} placeholder="Etiqueta…"
              style={{ background: "#0a0f1e", border: "1px solid #1e2d50", borderRadius: 5, color: "#e2e8f0", fontSize: 10, padding: "2px 7px", width: 90, outline: "none", flexShrink: 0 }} />
          )}

          {/* Clear all */}
          {drawings.length > 0 && (
            <button onClick={clearAllDrawings} title="Apagar tudo" style={{
              background: "transparent", color: "#ef4444", border: "1px solid #ef444440",
              borderRadius: 5, padding: compact ? "2px 6px" : "3px 8px", fontSize: 10, fontWeight: 700, cursor: "pointer", flexShrink: 0,
            }}>✕ Tudo</button>
          )}
        </div>

        {/* Row 2: Quick indicator toggles */}
        <div style={{ display: "flex", gap: compact ? 4 : 5, alignItems: "center", flexWrap: "nowrap", overflowX: "auto" }}>
          <span style={{ color: "#475569", fontSize: 9, fontWeight: 700, flexShrink: 0, textTransform: "uppercase", letterSpacing: 0.5 }}>Indicadores:</span>
          {([
            { key: "ma",   label: "MA",    color: "#f5a623", toggle: () => setIndicators(p => ({ ...p, ma:   { ...p.ma,   enabled: !p.ma.enabled   } })) },
            { key: "ema",  label: "EMA",   color: "#a78bfa", toggle: () => setIndicators(p => ({ ...p, ema:  { ...p.ema,  enabled: !p.ema.enabled  } })) },
            { key: "bb",   label: "BB",    color: "#38bdf8", toggle: () => setIndicators(p => ({ ...p, bb:   { ...p.bb,   enabled: !p.bb.enabled   } })) },
            { key: "rsi",  label: "RSI",   color: "#f97316", toggle: () => setIndicators(p => ({ ...p, rsi:  { ...p.rsi,  enabled: !p.rsi.enabled  } })) },
            { key: "macd", label: "MACD",  color: "#22c55e", toggle: () => setIndicators(p => ({ ...p, macd: { ...p.macd, enabled: !p.macd.enabled } })) },
            { key: "stoch",label: "Stoch", color: "#fb923c", toggle: () => setIndicators(p => ({ ...p, stoch:{ ...p.stoch,enabled: !p.stoch.enabled} })) },
          ] as const).map(ind => {
            const active = indicators[ind.key as keyof typeof indicators].enabled;
            return (
              <button key={ind.key} onClick={ind.toggle} style={{
                display: "flex", alignItems: "center", gap: 3,
                background: active ? `${ind.color}22` : "transparent",
                color: active ? ind.color : "#4b5563",
                border: `1px solid ${active ? ind.color : "#1e2d50"}`,
                borderRadius: 14, padding: compact ? "2px 8px" : "3px 9px",
                fontSize: compact ? 9 : 10, fontWeight: 700, cursor: "pointer",
                boxShadow: active ? `0 0 6px ${ind.color}44` : "none",
                transition: "all 0.13s", flexShrink: 0,
              }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: active ? ind.color : "#374151", flexShrink: 0 }} />
                {ind.label}
              </button>
            );
          })}
          {indicators.ma.enabled && ([9, 20, 50] as const).map(p => (
            <button key={`ma${p}`} onClick={() => setIndicators(prev => {
              const has = prev.ma.periods.includes(p);
              const periods = has ? prev.ma.periods.filter(x => x !== p) : [...prev.ma.periods, p];
              return { ...prev, ma: { ...prev.ma, periods: periods.length ? periods : [p] } };
            })} style={{
              background: indicators.ma.periods.includes(p) ? "#f5a62333" : "transparent",
              color: indicators.ma.periods.includes(p) ? "#f5a623" : "#4b5563",
              border: `1px solid ${indicators.ma.periods.includes(p) ? "#f5a623" : "#1e2d50"}`,
              borderRadius: 10, padding: "2px 6px", fontSize: 9, fontWeight: 800, cursor: "pointer", flexShrink: 0,
            }}>{p}</button>
          ))}
          {indicators.ema.enabled && ([9, 20, 50] as const).map(p => (
            <button key={`ema${p}`} onClick={() => setIndicators(prev => {
              const has = prev.ema.periods.includes(p);
              const periods = has ? prev.ema.periods.filter(x => x !== p) : [...prev.ema.periods, p];
              return { ...prev, ema: { ...prev.ema, periods: periods.length ? periods : [p] } };
            })} style={{
              background: indicators.ema.periods.includes(p) ? "#a78bfa33" : "transparent",
              color: indicators.ema.periods.includes(p) ? "#a78bfa" : "#4b5563",
              border: `1px solid ${indicators.ema.periods.includes(p) ? "#a78bfa" : "#1e2d50"}`,
              borderRadius: 10, padding: "2px 6px", fontSize: 9, fontWeight: 800, cursor: "pointer", flexShrink: 0,
            }}>{p}</button>
          ))}
        </div>

        {/* Row 3: Drawing list (only if there are drawings) */}
        {!compact && drawings.length > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
            {drawings.map(d => {
              const label = d.type === "hline"
                ? `H: ${(d as HLineDrawing).price.toFixed(dec)}${(d as HLineDrawing).label ? ` (${(d as HLineDrawing).label})` : ""}`
                : `Tendência`;
              return (
                <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 4, background: "#0a0f1e", border: "1px solid #1e2d50", borderRadius: 5, padding: "2px 6px" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: d.color, flexShrink: 0 }} />
                  <span style={{ color: "#94a3b8", fontSize: 10 }}>{label}</span>
                  <button onClick={() => removeDrawing(d.id)} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 11, padding: 0, lineHeight: 1 }}>✕</button>
                </div>
              );
            })}
          </div>
        )}
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
    const TF_H          = 36;
    const TRADEPANEL_H  = 162;
    const BOTTOMNAV_H   = 52;
    const OPSPANEL_H    = 230;
    const CONTENT_TOP   = TOPBAR_H + TF_H;
    const OVERLAY_TOP   = 0;
    const chartTop      = CONTENT_TOP;
    const chartH        = windowHeight > 0 ? windowHeight - CONTENT_TOP - TRADEPANEL_H - BOTTOMNAV_H : 360;

    return (
      <div style={{ height: "100vh", background: "#0a0f1e", fontFamily: "system-ui, -apple-system, sans-serif", overflow: "hidden" }}>

        <OnboardingTutorial />

        {/* Win/loss overlay */}
        {notification && (
          <TradeResultOverlay
            type={notification.type}
            msg={notification.msg}
            onDone={() => setNotification(null)}
          />
        )}

        {/* ── Topbar (chart tab only) ── */}
        {mobileTab === "chart" && <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: TOPBAR_H, zIndex: 110, background: "#080e1d", borderBottom: "1px solid #1a2540", display: "flex", alignItems: "center", padding: "0 10px", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            <div style={{ width: 24, height: 24, background: "linear-gradient(135deg,#f5a623,#e8940f)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 10px rgba(245,166,35,0.35)" }}>
              <TrendingUp size={12} color="#0a0f1e" strokeWidth={2.5} />
            </div>
            <span style={{ color: "#fff", fontWeight: 900, fontSize: 13, letterSpacing: 0.2 }}>Dynamics</span>
          </div>

          <button onClick={() => setMobileTab("markets")} style={{ background: "#0a0f1e", border: "1px solid #1e2d50", borderRadius: 8, padding: "5px 10px", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 13, fontWeight: 700 }}>
            {selectedPair?.label ?? "…"} <ChevronDown size={12} color="#94a3b8" />
          </button>
          <div style={{ flex: 1 }} />

          {isDemo && demoBalance < 5000 && (
            <button onClick={resetDemo} disabled={demoReloading}
              style={{ background: "transparent", border: "1px solid #f5a623", color: "#f5a623", borderRadius: 5, fontSize: 10, padding: "2px 6px", cursor: demoReloading ? "not-allowed" : "pointer", opacity: demoReloading ? 0.6 : 1, flexShrink: 0 }}>
              {demoReloading ? "..." : "↺"}
            </button>
          )}

          <NotificationBell />

          <button onClick={toggleAccount} style={{ background: isDemo ? "rgba(245,166,35,0.1)" : "rgba(34,197,94,0.1)", border: `1px solid ${isDemo ? "rgba(245,166,35,0.3)" : "rgba(34,197,94,0.3)"}`, borderRadius: 8, padding: "4px 9px", display: "flex", alignItems: "center", gap: 5, cursor: "pointer", flexShrink: 0 }}>
            <Wallet size={11} color={isDemo ? "#f5a623" : "#22c55e"} />
            <span style={{ color: "#fff", fontWeight: 800, fontSize: 11, fontVariantNumeric: "tabular-nums" }}>{formatKz(Math.floor(displayBalance))}</span>
            <span style={{ background: isDemo ? "#f5a623" : "#22c55e", color: "#0a0f1e", borderRadius: 3, fontSize: 8, padding: "1px 4px", fontWeight: 900 }}>{isDemo ? "D" : "R"}</span>
          </button>
        </div>}

        {/* ── Timeframe strip ── */}
        {mobileTab === "chart" && <div style={{ position: "fixed", top: TOPBAR_H, left: 0, right: 0, height: TF_H, zIndex: 108, background: "#080e1d", borderBottom: "1px solid #1a2540", display: "flex", alignItems: "center", padding: "0 10px", gap: 5 }}>
          {["1m", "5m", "15m", "1h", "1D"].map(tf => (
            <button key={tf} onClick={() => setTimeframe(tf)} style={{ height: 24, padding: "0 9px", background: timeframe === tf ? "#f5a623" : "transparent", color: timeframe === tf ? "#0a0f1e" : "#64748b", border: `1px solid ${timeframe === tf ? "#f5a623" : "#1e2d50"}`, borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              {tf}
            </button>
          ))}
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 5 }}>
            {candleTimer && <span style={{ fontSize: 11, fontWeight: 700, color: "#4b5563", fontVariantNumeric: "tabular-nums" }}>{candleTimer}</span>}


            <button onClick={() => setLeftPanel(p => p === "indicators" ? null : "indicators")} style={{ height: 24, padding: "0 8px", background: leftPanel === "indicators" ? "rgba(245,166,35,0.12)" : "transparent", color: leftPanel === "indicators" ? "#f5a623" : "#4b5563", border: `1px solid ${leftPanel === "indicators" ? "rgba(245,166,35,0.4)" : "#1e2d50"}`, borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              <Activity size={11} /> IND
            </button>
            <button onClick={() => { setLeftPanel(p => p === "drawings" ? null : "drawings"); if (leftPanel === "drawings") { setActiveTool(null); setPendingPoint(null); } }} style={{ height: 24, padding: "0 8px", background: leftPanel === "drawings" ? "rgba(34,197,94,0.1)" : "transparent", color: leftPanel === "drawings" ? "#22c55e" : "#4b5563", border: `1px solid ${leftPanel === "drawings" ? "rgba(34,197,94,0.4)" : "#1e2d50"}`, borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              <PenLine size={11} /> TOOLS
            </button>
          </div>
        </div>}

        {/* ── Painel mobile (indicadores / ferramentas) ── */}
        {leftPanel && renderSlideInPanel()}

        {/* ── Chart ── */}
        <div style={{ position: "fixed", top: chartTop, left: 0, right: 0, height: chartH, background: "#070d1c", overflow: "hidden" }}>
          <div ref={chartRef}
            style={{ width: "100%", height: "100%", cursor: activeTool ? "crosshair" : draggingHLine.current ? "ns-resize" : "default" }}
            onMouseDown={e => onChartPointerDown(e.clientY)}
            onMouseMove={e => onChartPointerMove(e.clientY)}
            onMouseUp={onChartPointerUp}
            onMouseLeave={onChartPointerUp}
            onTouchStart={e => onChartPointerDown(e.touches[0].clientY)}
            onTouchMove={e => { e.preventDefault(); onChartPointerMove(e.touches[0].clientY); }}
            onTouchEnd={onChartPointerUp}
          />
          {renderLegend()}

          {/* ── Tipo de gráfico (canto inferior esquerdo) ── */}
          {(() => {
            const CHART_ICONS: Record<ChartType, React.ReactNode> = {
              candle: <CandlestickChart size={13} />,
              line:   <LineChart size={13} />,
              area:   <AreaChart size={13} />,
              bar:    <BarChart size={13} />,
            };
            const nextType: Record<ChartType, ChartType> = { candle: "line", line: "area", area: "bar", bar: "candle" };
            const labels: Record<ChartType, string> = { candle: "Candlestick", line: "Linha", area: "Área", bar: "Barra" };
            return (
              <button onClick={() => setChartType(t => nextType[t])} title={labels[chartType]}
                style={{ position: "absolute", bottom: 32, left: 8, zIndex: 6, display: "flex", alignItems: "center", gap: 5, background: "rgba(8,14,29,0.88)", border: "1px solid #1e2d50", borderRadius: 7, padding: "5px 9px", color: "#94a3b8", cursor: "pointer", backdropFilter: "blur(4px)", fontSize: 10, fontWeight: 600 }}>
                {CHART_ICONS[chartType]}
                <span>{labels[chartType]}</span>
              </button>
            );
          })()}

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
          <div style={{ position: "fixed", top: CONTENT_TOP, left: 0, right: 0, bottom: TRADEPANEL_H + BOTTOMNAV_H, zIndex: 108, background: "#080e1d", display: "flex", flexDirection: "column" }}>
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

        {/* ── Bottom trade panel (only visible on chart tab) ── */}
        {mobileTab === "chart" && (() => {
          const btnDisabled = loading || currentPrice === 0;
          const currentPayout = payoutMap[selectedPair?.label ?? ""] ?? 0.74;
          const payoutAmt = Math.round(amount * currentPayout);

          // Cronómetro: countdown ao trade activo, ou duração seleccionada em repouso
          let timerDisplay: string;
          let timerColor = "#fff";
          {
            const mm = String(Math.floor(expiry.secs / 60)).padStart(2, "0");
            const ss = String(expiry.secs % 60).padStart(2, "0");
            timerDisplay = `${mm}:${ss}`;
          }

          return (
            <div style={{ position: "fixed", bottom: BOTTOMNAV_H, left: 0, right: 0, height: TRADEPANEL_H, zIndex: 110, background: "#080e1d", borderTop: "1px solid #1a2540", display: "flex", flexDirection: "column" }}>

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
                    <button key={opt.secs} onClick={() => setExpiry(opt)}
                      style={{ height: 22, padding: "0 7px", background: expiry.secs === opt.secs ? "#f5a623" : "#0b1220", color: expiry.secs === opt.secs ? "#0a0f1e" : "#64748b", border: `1px solid ${expiry.secs === opt.secs ? "#f5a623" : "#1a2540"}`, borderRadius: 5, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Row 2 — Tempo | Investimento */}
              <div style={{ display: "flex", gap: 8, padding: "6px 12px 0" }}>
                {/* Timer */}
                <div onClick={() => { if (!timerEditing) { setTimerEditing(true); setTimerInput(String(Math.floor(expiry.secs / 60))); } }}
                  style={{ flex: 1, background: "#0b1220", border: `1px solid ${timerEditing ? "#f5a623" : "#1a2540"}`, borderRadius: 10, padding: "6px 10px", cursor: "pointer", transition: "border-color 0.3s" }}>
                  <div style={{ color: "#334155", fontSize: 9, fontWeight: 600, letterSpacing: 0.8, marginBottom: 1 }}>
                    TEMPO {!timerEditing && <span style={{ color: "#f5a623" }}>✎</span>}
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
                <div onClick={() => { if (!amountEditing) { setAmountEditing(true); setAmountInput(String(amount)); } }}
                  style={{ flex: 2, background: "#0b1220", border: `1px solid ${amountEditing ? "#f5a623" : "#1a2540"}`, borderRadius: 10, padding: "6px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", transition: "border-color 0.3s" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: "#334155", fontSize: 9, fontWeight: 600, letterSpacing: 0.8, marginBottom: 1 }}>
                      INVESTIMENTO {!amountEditing && <span style={{ color: "#f5a623" }}>✎</span>}
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
                    <button onClick={() => setAmount(a => Math.max(1000, a - 500))}
                      style={{ width: 28, height: 28, background: "#1a2540", border: "none", borderRadius: 7, color: "#94a3b8", fontSize: 18, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                    <button onClick={() => setAmount(a => a + 500)}
                      style={{ width: 28, height: 28, background: "#1a2540", border: "none", borderRadius: 7, color: "#94a3b8", fontSize: 18, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                  </div>
                </div>
              </div>

              {/* Row 3 — ALTA + BAIXA */}
              <div style={{ display: "flex", gap: 8, padding: "7px 12px 8px", flex: 1 }}>
                <button onClick={() => openTrade("call")} disabled={btnDisabled}
                  style={{ flex: 1, background: "linear-gradient(150deg,#15803d,#22c55e)", color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 900, cursor: btnDisabled ? "not-allowed" : "pointer", opacity: btnDisabled ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, boxShadow: btnDisabled ? "none" : "0 3px 16px rgba(34,197,94,0.3)", letterSpacing: 0.5 }}>
                  {loading ? "..." : <><TrendingUp size={17} strokeWidth={2.5} /> ALTA</>}
                </button>
                <button onClick={() => openTrade("put")} disabled={btnDisabled}
                  style={{ flex: 1, background: "linear-gradient(150deg,#b91c1c,#ef4444)", color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 900, cursor: btnDisabled ? "not-allowed" : "pointer", opacity: btnDisabled ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, boxShadow: btnDisabled ? "none" : "0 3px 16px rgba(239,68,68,0.3)", letterSpacing: 0.5 }}>
                  {loading ? "..." : <><TrendingDown size={17} strokeWidth={2.5} /> BAIXA</>}
                </button>
              </div>
            </div>
          );
        })()}

        {/* ── Markets overlay ── */}
        {mobileTab === "markets" && (
          <div style={{ position: "fixed", top: OVERLAY_TOP, left: 0, right: 0, bottom: BOTTOMNAV_H, zIndex: 115, background: "#080e1d", display: "flex", flexDirection: "column" }}>
            {/* Header */}
            <div style={{ padding: "12px 14px 8px", flexShrink: 0, borderBottom: "1px solid #1a2540" }}>
              <span style={{ color: "#fff", fontWeight: 900, fontSize: 15 }}>Mercados</span>
            </div>
            {/* Pairs list */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              {(() => {
                const groups: Record<string, DerivPair[]> = {};
                pairs.forEach(p => { (groups[p.category] ??= []).push(p); });
                const catOrder  = ["Forex", "Cripto", "Metal", "Índices", "Sintético"];
                const catColors: Record<string, string> = { Forex: "#f5a623", Cripto: "#a78bfa", Metal: "#fcd34d", Índices: "#22c55e", Sintético: "#38bdf8" };
                return catOrder.filter(cat => groups[cat]).map(cat => (
                  <div key={cat}>
                    <div style={{ padding: "10px 14px 5px", fontSize: 10, fontWeight: 700, color: catColors[cat] ?? "#94a3b8", letterSpacing: 1.2, textTransform: "uppercase", background: "#060c1a" }}>
                      {cat}
                    </div>
                    {groups[cat].map(p => {
                      const price   = tickerPrices[p.symbol] ?? 0;
                      const seed    = SEED_PRICES[p.symbol] ?? 1;
                      const isUp    = price >= seed;
                      const pct     = seed > 0 && price > 0 ? ((price - seed) / seed * 100) : 0;
                      const isActive = selectedPair?.symbol === p.symbol;
                      return (
                        <button key={p.symbol} onClick={() => { setSelectedPair(p); setMobileTab("chart"); setAssetDropdown(false); }}
                          style={{ width: "100%", background: isActive ? "rgba(245,166,35,0.07)" : "transparent", border: "none", borderBottom: "1px solid #0d1526", padding: "13px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            {isActive && <div style={{ width: 3, height: 28, background: "#f5a623", borderRadius: 2, position: "absolute", left: 0 }} />}
                            <div style={{ textAlign: "left" }}>
                              <div style={{ color: isActive ? "#f5a623" : "#fff", fontWeight: 700, fontSize: 14 }}>{p.label}</div>
                              <div style={{ color: "#334155", fontSize: 11, marginTop: 1 }}>{p.category}</div>
                            </div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ color: price > 0 ? (isUp ? "#22c55e" : "#ef4444") : "#334155", fontWeight: 800, fontSize: 14, fontVariantNumeric: "tabular-nums" }}>
                              {price > 0 ? price.toFixed(p.decimals) : "—"}
                            </div>
                            {price > 0 && (
                              <div style={{ color: isUp ? "#22c55e" : "#ef4444", fontSize: 11, marginTop: 1 }}>
                                {isUp ? "▲" : "▼"} {Math.abs(pct).toFixed(2)}%
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ));
              })()}
            </div>
          </div>
        )}

        {/* ── Wallet overlay ── */}
        {mobileTab === "wallet" && (
          <div style={{ position: "fixed", top: OVERLAY_TOP, left: 0, right: 0, bottom: BOTTOMNAV_H, zIndex: 115, background: "#080e1d", display: "flex", flexDirection: "column", overflowY: "auto" }}>
            <div style={{ padding: "14px 14px 0", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <span style={{ color: "#fff", fontWeight: 900, fontSize: 15 }}>Carteira</span>
              <button onClick={() => setWalletData(null)} style={{ background: "none", border: "none", color: "#f5a623", fontSize: 12, fontWeight: 700, cursor: "pointer", padding: "4px 8px" }}>↺ Actualizar</button>
            </div>

            {walletLoading ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: "#f5a623", fontSize: 13 }}>A carregar...</span>
              </div>
            ) : walletData ? (
              <div style={{ padding: "12px 14px", flex: 1 }}>
                {/* Balance cards */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                  <div style={{ background: "linear-gradient(135deg,#0d1f12,#142a1a)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 12, padding: "12px 14px" }}>
                    <div style={{ color: "#64748b", fontSize: 10, fontWeight: 600, letterSpacing: 0.8, marginBottom: 4 }}>SALDO REAL</div>
                    <div style={{ color: "#22c55e", fontWeight: 900, fontSize: 16, fontVariantNumeric: "tabular-nums" }}>{formatKz(Math.floor(walletData.balance))}</div>
                  </div>
                  <div style={{ background: "linear-gradient(135deg,#1a1206,#261b08)", border: "1px solid rgba(245,166,35,0.25)", borderRadius: 12, padding: "12px 14px" }}>
                    <div style={{ color: "#64748b", fontSize: 10, fontWeight: 600, letterSpacing: 0.8, marginBottom: 4 }}>SALDO DEMO</div>
                    <div style={{ color: "#f5a623", fontWeight: 900, fontSize: 16, fontVariantNumeric: "tabular-nums" }}>{formatKz(Math.floor(walletData.demoBalance))}</div>
                  </div>
                </div>

                {/* Deposit / Withdraw buttons */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                  <a href="/wallet?tab=deposit" style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 10, padding: "10px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, textDecoration: "none" }}>
                    <span style={{ fontSize: 18 }}>↓</span>
                    <span style={{ color: "#22c55e", fontSize: 12, fontWeight: 700 }}>Depositar</span>
                  </a>
                  <a href="/wallet?tab=withdraw" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10, padding: "10px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, textDecoration: "none" }}>
                    <span style={{ fontSize: 18, color: "#ef4444" }}>↑</span>
                    <span style={{ color: "#ef4444", fontSize: 12, fontWeight: 700 }}>Levantar</span>
                  </a>
                </div>

                {/* Recent transactions */}
                <div style={{ color: "#64748b", fontSize: 11, fontWeight: 600, letterSpacing: 0.8, marginBottom: 8 }}>MOVIMENTOS RECENTES</div>
                {walletData.transactions.length === 0 ? (
                  <div style={{ color: "#334155", fontSize: 13, textAlign: "center", padding: "20px 0" }}>Sem movimentos ainda</div>
                ) : walletData.transactions.map((tx: any) => {
                  const isDeposit = tx.type === "deposit";
                  const statusColor = tx.status === "completed" ? "#22c55e" : tx.status === "rejected" ? "#ef4444" : "#f5a623";
                  return (
                    <div key={tx.id} style={{ background: "#0d1526", borderRadius: 10, padding: "10px 12px", marginBottom: 7, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: isDeposit ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
                          {isDeposit ? "↓" : "↑"}
                        </div>
                        <div>
                          <div style={{ color: "#fff", fontWeight: 700, fontSize: 12 }}>{isDeposit ? "Depósito" : "Levantamento"}</div>
                          <div style={{ color: statusColor, fontSize: 10, fontWeight: 600 }}>{tx.status === "completed" ? "Concluído" : tx.status === "rejected" ? "Rejeitado" : "Pendente"}</div>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ color: isDeposit ? "#22c55e" : "#ef4444", fontWeight: 800, fontSize: 13 }}>{isDeposit ? "+" : "−"}{formatKz(tx.amount)}</div>
                        <div style={{ color: "#334155", fontSize: 10 }}>{new Date(tx.createdAt).toLocaleDateString("pt-AO", { day: "2-digit", month: "short" })}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        )}

        {/* ── Account overlay ── */}
        {mobileTab === "account" && (
          <div style={{ position: "fixed", top: OVERLAY_TOP, left: 0, right: 0, bottom: BOTTOMNAV_H, zIndex: 115, background: "#080e1d", overflowY: "auto" }}>
            <div style={{ padding: "16px 14px" }}>
              {/* Avatar + name */}
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20, padding: "14px", background: "#0d1526", borderRadius: 14, border: "1px solid #1a2540" }}>
                <div style={{ width: 50, height: 50, borderRadius: "50%", background: "linear-gradient(135deg,#f5a623,#e8940f)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 18, color: "#0a0f1e", flexShrink: 0 }}>
                  {session?.user?.name?.split(" ").filter(Boolean).slice(0, 2).map((w: string) => w[0]).join("").toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>{session?.user?.name}</div>
                  <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>{session?.user?.email}</div>
                </div>
              </div>

              {/* Demo / Real toggle */}
              <div style={{ background: "#0d1526", border: "1px solid #1a2540", borderRadius: 12, padding: "12px 14px", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>Modo de conta</div>
                  <div style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>{isDemo ? "A negociar com saldo demo" : "A negociar com saldo real"}</div>
                </div>
                <button onClick={toggleAccount} style={{ background: isDemo ? "rgba(245,166,35,0.15)" : "rgba(34,197,94,0.15)", border: `1px solid ${isDemo ? "rgba(245,166,35,0.4)" : "rgba(34,197,94,0.4)"}`, borderRadius: 8, padding: "6px 14px", color: isDemo ? "#f5a623" : "#22c55e", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>
                  {isDemo ? "DEMO" : "REAL"}
                </button>
              </div>

              {/* Nav links */}
              {[
                { href: "/profile",   icon: <User size={16} color="#f5a623" />,       label: "Perfil",             desc: "Editar dados pessoais" },
                { href: "/dashboard", icon: <BarChart2 size={16} color="#f5a623" />,   label: "Dashboard",          desc: "Estatísticas das operações" },
                { href: "/history",   icon: <History size={16} color="#f5a623" />,     label: "Histórico",          desc: "Todas as operações fechadas" },
                { href: "/ranking",   icon: <Trophy size={16} color="#f5a623" />,      label: "Ranking & Torneios", desc: "Competir com outros traders" },
                { href: "/wallet",    icon: <Wallet size={16} color="#f5a623" />,      label: "Carteira completa",  desc: "Depósitos e levantamentos" },
              ].map(({ href, icon, label, desc }) => (
                <a key={href} href={href} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", background: "#0d1526", border: "1px solid #1a2540", borderRadius: 12, marginBottom: 8, textDecoration: "none" }}>
                  <div style={{ width: 32, height: 32, background: "rgba(245,166,35,0.1)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>{label}</div>
                    <div style={{ color: "#64748b", fontSize: 11, marginTop: 1 }}>{desc}</div>
                  </div>
                  <span style={{ color: "#334155", fontSize: 16 }}>›</span>
                </a>
              ))}

              {/* Suporte — ticket interno */}
              <a href="/support" style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.2)", borderRadius: 12, marginBottom: 8, textDecoration: "none" }}>
                <div style={{ width: 32, height: 32, background: "#f5a623", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Headphones size={16} color="#0a0f1e" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>Suporte</div>
                  <div style={{ color: "#64748b", fontSize: 11, marginTop: 1 }}>Abrir ticket de suporte</div>
                </div>
                <span style={{ color: "#334155", fontSize: 16 }}>›</span>
              </a>

              {/* Suporte — WhatsApp */}
              <a href={`https://wa.me/244946621503?text=${encodeURIComponent("Olá! Preciso de ajuda com a minha conta na Dynamics Works.")}`} target="_blank" rel="noopener noreferrer"
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", background: "rgba(37,211,102,0.08)", border: "1px solid rgba(37,211,102,0.2)", borderRadius: 12, marginBottom: 8, textDecoration: "none" }}>
                <div style={{ width: 32, height: 32, background: "#25D366", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <MessageCircle size={16} color="#fff" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>WhatsApp</div>
                  <div style={{ color: "#64748b", fontSize: 11, marginTop: 1 }}>Resposta rápida</div>
                </div>
                <span style={{ color: "#334155", fontSize: 16 }}>›</span>
              </a>

              {/* Logout */}
              <button onClick={() => signOut({ callbackUrl: "/login" })} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px 14px", background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, color: "#ef4444", fontWeight: 700, fontSize: 13, cursor: "pointer", marginTop: 4 }}>
                <LogOut size={15} /> Sair da conta
              </button>
            </div>
          </div>
        )}

        {/* ── Bottom navigation bar ── */}
        {(() => {
          const NAV = [
            { id: "chart",   icon: <TrendingUp size={19} />, label: "Operar"   },
            { id: "markets", icon: <BarChart2 size={19} />,  label: "Mercados" },
            { id: "trade",   icon: <Clock size={19} />,      label: "Posições" },
            { id: "wallet",  icon: <Wallet size={19} />,     label: "Carteira" },
            { id: "account", icon: <User size={19} />,       label: "Conta"    },
          ] as const;
          return (
            <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: BOTTOMNAV_H, zIndex: 120, background: "#060c1a", borderTop: "1px solid #1a2540", display: "flex", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
              {NAV.map(({ id, icon, label }) => {
                const active = mobileTab === id || (id === "trade" && showTradesPanel && mobileTab === "chart");
                return (
                  <button key={id} onClick={() => {
                    if (id === "trade") {
                      setMobileTab("chart");
                      setShowTradesPanel(v => { if (!v) { setTradeHistoryTab("open"); fetchTradeHistory(); } return !v; });
                    } else {
                      setMobileTab(id);
                      if (id !== "wallet") setWalletData(null);
                      setShowTradesPanel(false);
                    }
                  }} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, background: "none", border: "none", cursor: "pointer", color: active ? "#f5a623" : "#334155", transition: "color 0.2s" }}>
                    {icon}
                    <span style={{ fontSize: 9, fontWeight: active ? 800 : 600, letterSpacing: 0.3 }}>{label}</span>
                    {active && <div style={{ position: "absolute", bottom: "env(safe-area-inset-bottom, 0px)", width: 28, height: 2, background: "#f5a623", borderRadius: 2 }} />}
                  </button>
                );
              })}
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
          </div>
          <div style={{ flex: 1, minHeight: 0, position: "relative" }} onClick={() => { if (expandedItem === "__charttype") setExpandedItem(null); }}>
            {/* Left sidebar */}
            {renderLeftSidebar()}
            {/* Slide-in panel */}
            {renderSlideInPanel()}
            <div ref={chartRef}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, cursor: activeTool ? "crosshair" : draggingHLine.current ? "ns-resize" : "default" }}
            onMouseDown={e => onChartPointerDown(e.clientY)}
            onMouseMove={e => onChartPointerMove(e.clientY)}
            onMouseUp={onChartPointerUp}
            onMouseLeave={onChartPointerUp}
            onTouchStart={e => onChartPointerDown(e.touches[0].clientY)}
            onTouchMove={e => { e.preventDefault(); onChartPointerMove(e.touches[0].clientY); }}
            onTouchEnd={onChartPointerUp}
          />
            {renderLegend()}
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
