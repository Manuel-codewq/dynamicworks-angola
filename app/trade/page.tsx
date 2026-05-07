"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  TrendingUp, TrendingDown, ChevronDown, Clock, Wallet,
  User, LogOut, BarChart2, AlertCircle, X, DollarSign,
} from "lucide-react";
import {
  createChart, IChartApi, ISeriesApi, CandlestickData, Time, CandlestickSeries,
} from "lightweight-charts";
import {
  derivWS, getAvailablePairs, GRANULARITY, OTC_BASE_PRICES,
  type DerivPair, type DerivCandle,
} from "@/lib/derivWebSocket";
import NotificationBell from "@/app/components/NotificationBell";

// ── OTC simulation state (module-level — persists across re-renders) ─────────
const OTC_STATE: Record<string, { price: number; momentum: number }> = {};

// Fetch real recorded OTC candles from the DB; returns null when fallback needed
async function fetchOtcCandles(
  asset: string,
  timeframe: string,
  count: number,
): Promise<CandlestickData[] | null> {
  try {
    const params = new URLSearchParams({ asset, timeframe, count: String(count) });
    const res = await fetch(`/api/otc-candles?${params}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.fallback) return null;
    return (data as Array<{ open: number; high: number; low: number; close: number; timestamp: string }>)
      .map(c => ({
        time:  Math.floor(new Date(c.timestamp).getTime() / 1000) as Time,
        open:  c.open,
        high:  c.high,
        low:   c.low,
        close: c.close,
      }));
  } catch {
    return null;
  }
}

// ── Constants ────────────────────────────────────────────────────────────────

const EXPIRY_OPTIONS = [
  { label: "1 min",  secs: 60   },
  { label: "5 min",  secs: 300  },
  { label: "15 min", secs: 900  },
  { label: "1 hora", secs: 3600 },
];

const QUICK_AMOUNTS = [1000, 5000, 10000, 25000];

const FAKE_NAMES = [
  "João de Luanda", "Maria de Benguela", "Pedro do Huambo", "Ana de Cabinda",
  "Carlos do Bié", "Sofia de Malanje", "David do Namibe", "Graça de Huíla",
  "António do Uíge", "Beatriz do Cunene",
];

// Approximate initial prices for placeholder candles while WS connects
const SEED_PRICES: Record<string, number> = {
  frxEURUSD: 1.085, frxGBPUSD: 1.265, frxUSDJPY: 149.5,
  frxAUDUSD: 0.652, frxUSDCAD: 1.362, frxEURGBP: 0.858,
  frxUSDCHF: 0.897, frxNZDUSD: 0.607,
  R_10: 6300, R_25: 5800, R_50: 4500, R_75: 3700, R_100: 9800,
  BOOM300: 7800, CRASH300: 7800,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatKz(n: number) {
  return n.toLocaleString("pt-AO") + " Kz";
}

// Placeholder candles — shown while WS data loads (correct OHLC invariants)
function generatePlaceholder(basePrice: number, count = 100): CandlestickData[] {
  const map = new Map<number, CandlestickData>();
  const now  = Math.floor(Date.now() / 60000) * 60;
  const maxSpread = basePrice * 0.005;
  let price = basePrice;

  for (let i = count; i >= 0; i--) {
    const t = now - i * 60;
    const change  = (Math.random() - 0.49) * maxSpread * 0.4;
    const open    = price;
    const close   = price + change;
    if (!isFinite(open) || !isFinite(close) || open === 0) continue;

    const bodyHigh = Math.max(open, close);
    const bodyLow  = Math.min(open, close);
    const safeHigh = Math.max(bodyHigh + Math.random() * maxSpread * 0.5, bodyHigh);
    const safeLow  = Math.min(bodyLow  - Math.random() * maxSpread * 0.5, bodyLow);

    if (!isFinite(safeHigh) || !isFinite(safeLow) || safeHigh < safeLow) continue;
    map.set(t, { time: t as Time, open, high: safeHigh, low: safeLow, close });
    price = close;
  }
  return Array.from(map.values()).sort((a, b) => (a.time as number) - (b.time as number));
}

// OTC historical candles — smooth Brownian motion seeded from base price
function generateOtcCandles(symbol: string, count = 150): CandlestickData[] {
  const base = OTC_BASE_PRICES[symbol] ?? 1;
  if (!OTC_STATE[symbol]) OTC_STATE[symbol] = { price: base, momentum: 0 };
  const state = OTC_STATE[symbol];
  state.price = base; state.momentum = 0;

  const map = new Map<number, CandlestickData>();
  const now  = Math.floor(Date.now() / 60000) * 60;
  for (let i = count; i >= 0; i--) {
    const t = now - i * 60;
    const vol = state.price * 0.0003;
    state.momentum = state.momentum * 0.92 + (Math.random() - 0.5) * vol;
    const open  = state.price;
    const close = Math.max(state.price * 0.5, state.price + state.momentum);
    state.price  = close;
    const high   = Math.max(open, close) + Math.random() * vol * 0.5;
    const low    = Math.min(open, close) - Math.random() * vol * 0.5;
    if (!isFinite(open) || !isFinite(close) || high < low) continue;
    map.set(t, { time: t as Time, open, high, low, close });
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

  // ── Available pairs (weekday forex / weekend synthetic) ──────────────────
  const [pairs]        = useState<DerivPair[]>(() =>
    typeof window === "undefined" ? [] : getAvailablePairs()
  );
  const [selectedPair, setSelectedPair] = useState<DerivPair | null>(null);
  // initialise after pairs are known (avoids SSR mismatch)
  useEffect(() => { if (pairs.length > 0 && !selectedPair) setSelectedPair(pairs[0]); }, [pairs]); // eslint-disable-line

  // ── UI state ─────────────────────────────────────────────────────────────
  const [assetDropdown, setAssetDropdown] = useState(false);
  const [currentPrice,  setCurrentPrice]  = useState(0);
  const [priceUp,       setPriceUp]       = useState(true);
  const [amount,        setAmount]        = useState(1000);
  const [expiry,        setExpiry]        = useState(EXPIRY_OPTIONS[0]);
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
  const [clockStr,       setClockStr]       = useState("");
  const [demoReloading,  setDemoReloading]  = useState(false);
  const [bnaRate,        setBnaRate]        = useState<number | null>(null);
  const [candleTimer,    setCandleTimer]    = useState("");

  // ── Refs ─────────────────────────────────────────────────────────────────
  const chartRef           = useRef<HTMLDivElement>(null);
  const chartApiRef        = useRef<IChartApi | null>(null);
  const candleSeriesRef    = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const currentCandleRef   = useRef<CandlestickData | null>(null);
  const lastPriceRef       = useRef<number>(0);
  const tradePriceLinesRef = useRef<Map<string, any>>(new Map());
  const activeTradesRef    = useRef<ActiveTrade[]>([]);
  // Stable refs for use inside WS callbacks (avoid stale closures)
  const selectedPairRef  = useRef<DerivPair | null>(null);
  const timeframeRef     = useRef<string>("1m");

  useEffect(() => { selectedPairRef.current = selectedPair; }, [selectedPair]);
  useEffect(() => { timeframeRef.current = timeframe; },       [timeframe]);

  // ── Clock ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const tick = () => setClockStr(new Date().toLocaleTimeString("pt-AO", { hour: "2-digit", minute: "2-digit" }));
    tick();
    const id = setInterval(tick, 10000);
    return () => clearInterval(id);
  }, []);

  // ── Candle countdown timer ──────────────────────────────────────────────
  useEffect(() => {
    function tick() {
      const gran = GRANULARITY[timeframe] ?? 60;
      const now  = Math.floor(Date.now() / 1000);
      const rem  = gran - (now % gran);
      const m    = Math.floor(rem / 60);
      const s    = rem % 60;
      setCandleTimer(`${m}:${String(s).padStart(2, "0")}`);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [timeframe]);

  // ── BNA exchange rate (fetched once per hour) ───────────────────────────
  useEffect(() => {
    const fetchRate = () =>
      fetch("/api/bna-rate").then(r => r.ok ? r.json() : null).then(d => {
        if (d?.usdToKz) setBnaRate(d.usdToKz);
      }).catch(() => {});
    fetchRate();
    const id = setInterval(fetchRate, 3_600_000);
    return () => clearInterval(id);
  }, []);

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
      setPriceUp(q >= lastPriceRef.current);
      lastPriceRef.current = q;
      setCurrentPrice(q);
      setSentiment(Math.floor(45 + Math.random() * 30));

      // Update live candle
      if (!candleSeriesRef.current) return;
      const gran = GRANULARITY[timeframeRef.current] ?? 60;
      const candleTime = (Math.floor(tick.epoch / gran) * gran) as Time;
      const c = currentCandleRef.current;

      if (!c || (c.time as number) < (candleTime as number)) {
        const newC: CandlestickData = { time: candleTime, open: q, high: q, low: q, close: q };
        currentCandleRef.current = newC;
        candleSeriesRef.current.update(newC);
      } else {
        const updated: CandlestickData = {
          ...c, high: Math.max(c.high, q), low: Math.min(c.low, q), close: q,
        };
        currentCandleRef.current = updated;
        candleSeriesRef.current.update(updated);
      }
    });

    const unsubCandles = derivWS.onCandles((symbol, raw) => {
      // Ignore stale responses from a previously selected pair
      if (symbol !== selectedPairRef.current?.symbol) return;
      if (!candleSeriesRef.current) return;

      const candles = toChartCandles(raw);
      if (candles.length === 0) return;

      candleSeriesRef.current.setData(candles);
      currentCandleRef.current = candles[candles.length - 1];
      chartApiRef.current?.timeScale().fitContent();

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
      derivWS.unsubscribeAll();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isOTC = selectedPair?.symbol.startsWith("OTC_") ?? false;

  // ── Subscribe to ticks + request candles when pair or timeframe changes ──
  useEffect(() => {
    if (!selectedPair || isOTC) return;

    // Subscribe to all live pairs for the ticker
    const liveSymbols = pairs.filter(p => !p.symbol.startsWith("OTC_")).map(p => p.symbol);
    derivWS.subscribeToTicks(liveSymbols);

    // Request candle history for selected pair + timeframe
    derivWS.getCandles(selectedPair.symbol, GRANULARITY[timeframe], 150);

    // Reset price so we wait for real tick
    lastPriceRef.current = 0;
  }, [selectedPair, timeframe, isOTC, pairs]);

  // ── OTC price simulation ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isOTC || !selectedPair) return;
    const sym = selectedPair.symbol;
    if (!OTC_STATE[sym]) {
      OTC_STATE[sym] = { price: OTC_BASE_PRICES[sym] ?? 1, momentum: 0 };
    }
    // Seed price display immediately
    const initPrice = OTC_STATE[sym].price;
    lastPriceRef.current = initPrice;
    setCurrentPrice(initPrice);

    const id = setInterval(() => {
      const state = OTC_STATE[sym];
      if (!state) return;
      const vol   = state.price * 0.0003;
      state.momentum = state.momentum * 0.92 + (Math.random() - 0.5) * vol;
      state.price    = Math.max(state.price * 0.5, state.price + state.momentum);
      const q = state.price;

      setPriceUp(q >= lastPriceRef.current);
      lastPriceRef.current = q;
      setCurrentPrice(q);
      setSentiment(Math.floor(45 + Math.random() * 30));

      if (!candleSeriesRef.current) return;
      const gran = GRANULARITY[timeframeRef.current] ?? 60;
      const now  = Math.floor(Date.now() / 1000);
      const candleTime = (Math.floor(now / gran) * gran) as Time;
      const c = currentCandleRef.current;

      if (!c || (c.time as number) < (candleTime as number)) {
        const newC: CandlestickData = { time: candleTime, open: q, high: q, low: q, close: q };
        currentCandleRef.current = newC;
        candleSeriesRef.current.update(newC);
      } else {
        const updated: CandlestickData = { ...c, high: Math.max(c.high, q), low: Math.min(c.low, q), close: q };
        currentCandleRef.current = updated;
        candleSeriesRef.current.update(updated);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [isOTC, selectedPair]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fake wins feed ───────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      const name = FAKE_NAMES[Math.floor(Math.random() * FAKE_NAMES.length)];
      const amt  = (Math.floor(Math.random() * 20) + 1) * 1000;
      setRecentWins(prev => [{ name, amount: amt, time: Date.now() }, ...prev].slice(0, 5));
    }, 4000);
    return () => clearInterval(id);
  }, []);

  // ── Chart init / reinit ─────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedPair) return;
    if (isMobile && windowHeight === 0) return;

    const TOPBAR_H    = 52;
    const TICKER_H    = 28;
    const TF_H        = 38;
    const BOTTOMNAV_H = 60;
    const chartHeight = isMobile
      ? windowHeight - TOPBAR_H - TICKER_H - TF_H - BOTTOMNAV_H
      : (chartRef.current?.clientHeight || 500);

    function initChart() {
      const el = chartRef.current;
      if (!el) return;
      if (chartApiRef.current) { chartApiRef.current.remove(); chartApiRef.current = null; }

      const w = el.clientWidth || window.innerWidth;
      const h = chartHeight;
      if (w === 0 || h === 0) return;

      const chart = createChart(el, {
        layout: { background: { color: "#0a0f1e" }, textColor: "#94a3b8" },
        grid:   { vertLines: { color: "#1e2d50" }, horzLines: { color: "#1e2d50" } },
        crosshair:       { mode: 1 },
        rightPriceScale: { borderColor: "#1e2d50" },
        timeScale:       { borderColor: "#1e2d50", timeVisible: true },
        width: w, height: h,
      });
      chartApiRef.current = chart;

      const series = chart.addSeries(CandlestickSeries, {
        upColor:       "#22c55e", downColor:       "#ef4444",
        borderUpColor: "#22c55e", borderDownColor: "#ef4444",
        wickUpColor:   "#22c55e", wickDownColor:   "#ef4444",
      });
      candleSeriesRef.current  = series;
      currentCandleRef.current = null;
      tradePriceLinesRef.current.clear();

      // Live pairs: placeholder while WS loads.
      // OTC pairs: simulation shown immediately, then replaced by real DB data if available.
      const sym = selectedPair!.symbol;
      if (sym.startsWith("OTC_")) {
        const simCandles = generateOtcCandles(sym);
        series.setData(simCandles);
        currentCandleRef.current = simCandles[simCandles.length - 1];
        chart.timeScale().fitContent();

        // Asynchronously try to replace with real recorded candles
        fetchOtcCandles(selectedPair!.label, timeframeRef.current, 150).then(real => {
          if (!real || !candleSeriesRef.current || !chartApiRef.current) return;
          candleSeriesRef.current.setData(real);
          const last = real[real.length - 1];
          currentCandleRef.current = last;
          chartApiRef.current.timeScale().fitContent();
          // Seed OTC simulation from last real close so ticks continue smoothly
          if (OTC_STATE[sym]) {
            OTC_STATE[sym].price    = last.close;
            OTC_STATE[sym].momentum = 0;
          }
          lastPriceRef.current = last.close;
          setCurrentPrice(last.close);
        });
      } else {
        const seed = generatePlaceholder(SEED_PRICES[sym] ?? 1);
        series.setData(seed);
        currentCandleRef.current = seed[seed.length - 1];
        chart.timeScale().fitContent();
      }

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
    async function poll() {
      const res = await fetch("/api/trade");
      if (!res.ok) return;
      const data = await res.json();
      const trades: any[] = data.trades ?? [];
      setActiveTrades(trades.filter((t: any) => t.status === "active"));
      const justClosed = trades.filter((t: any) => {
        if (t.status !== "closed") return false;
        return Date.now() - new Date(t.closedAt).getTime() < 6000;
      });
      if (justClosed.length > 0) {
        const t = justClosed[0];
        setNotification({
          msg: t.result === "win"
            ? `Ganhou +${formatKz(Math.round(t.profit))} 🎉`
            : `Perdeu ${formatKz(t.amount)}`,
          type: t.result === "win" ? "win" : "loss",
        });
        setTimeout(() => setNotification(null), 4000);
        fetchBalance();
      }
    }
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, [fetchBalance]);

  // ── Price lines — create/remove when active trades change ────────────────
  useEffect(() => {
    activeTradesRef.current = activeTrades;
    if (!candleSeriesRef.current) return;
    const activeIds = new Set(activeTrades.map(t => t.id));
    // Remove lines for closed trades
    tradePriceLinesRef.current.forEach((line, id) => {
      if (!activeIds.has(id)) {
        try { candleSeriesRef.current?.removePriceLine(line); } catch {}
        tradePriceLinesRef.current.delete(id);
      }
    });
    // Add lines for new trades on the current asset
    activeTrades.filter(t => t.asset === selectedPair?.label).forEach(t => {
      const win   = t.direction === "call" ? lastPriceRef.current > t.entryPrice : lastPriceRef.current < t.entryPrice;
      const color = win ? "#22c55e" : "#ef4444";
      const title = `${t.direction === "call" ? "▲" : "▼"} ${formatKz(t.amount)}`;
      if (tradePriceLinesRef.current.has(t.id)) {
        tradePriceLinesRef.current.get(t.id).applyOptions({ color, title });
      } else if (candleSeriesRef.current) {
        const line = candleSeriesRef.current.createPriceLine({ price: t.entryPrice, color, lineWidth: 2, lineStyle: 2, axisLabelVisible: true, title });
        tradePriceLinesRef.current.set(t.id, line);
      }
    });
  }, [activeTrades, selectedPair]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Price lines — update colour on every tick ─────────────────────────────
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

  function getCountdown(trade: ActiveTrade) {
    const elapsed = (Date.now() - new Date(trade.createdAt).getTime()) / 1000;
    const rem = Math.max(0, trade.expirySecs - elapsed);
    return `${Math.floor(rem / 60)}:${String(Math.floor(rem % 60)).padStart(2, "0")}`;
  }

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
          entryPrice: currentPrice,
        }),
      });
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
        fetch("/api/trade").then(r => r.json()).then(d => {
          const ts: any[] = d.trades ?? [];
          setActiveTrades(ts.filter((t: any) => t.status === "active"));
        });
      }
    } catch {
      setNotification({ msg: "Erro de ligação. Tente novamente.", type: "info" });
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
  const profit         = amount * 0.85;
  const decimals       = selectedPair?.decimals ?? 5;
  const priceStr       = currentPrice > 0 ? currentPrice.toFixed(decimals) : "—";

  // ── Shared trade panel ────────────────────────────────────────────────────
  function renderTradePanel(compact = false) { return (
    <div style={{ display: "flex", flexDirection: "column", gap: compact ? 10 : 12 }}>
      {/* Live price */}
      <div style={{
        background: "#0a0f1e", border: "1px solid #1e2d50", borderRadius: 10,
        padding: compact ? "10px 12px" : "14px 16px", textAlign: "center",
      }}>
        <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 2 }}>{selectedPair?.label}</div>
        <div style={{ fontSize: compact ? 22 : 28, fontWeight: 800, color: priceUp ? "#22c55e" : "#ef4444", letterSpacing: 0.5 }}>
          {priceStr}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginTop: 2 }}>
          {priceUp ? <TrendingUp size={12} color="#22c55e" /> : <TrendingDown size={12} color="#ef4444" />}
          <span style={{ color: priceUp ? "#22c55e" : "#ef4444", fontSize: 11 }}>
            {currentPrice > 0 ? (priceUp ? "▲ A subir" : "▼ A descer") : "Conectando..."}
          </span>
        </div>
      </div>

      {/* Amount */}
      <div style={{ background: "#0a0f1e", border: "1px solid #1e2d50", borderRadius: 10, padding: 12 }}>
        <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 6 }}>Valor de investimento</div>
        <div style={{ position: "relative", marginBottom: 8 }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#f5a623", fontWeight: 700, fontSize: 13 }}>Kz</span>
          <input type="number" value={amount || ""}
            onChange={e => { const v = parseInt(e.target.value); setAmount(isNaN(v) ? 0 : Math.min(500000, v)); }}
            onBlur={() => setAmount(a => Math.max(1000, a || 1000))}
            placeholder="1000"
            style={{ width: "100%", background: "#111827", border: "1px solid #1e2d50", borderRadius: 8, padding: "10px 10px 10px 32px", color: "#fff", fontSize: 16, fontWeight: 700, outline: "none", boxSizing: "border-box" }} />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {QUICK_AMOUNTS.map(q => (
            <button key={q} onClick={() => setAmount(q)}
              style={{ flex: 1, height: 36, background: amount === q ? "#f5a623" : "#1e2d50", color: amount === q ? "#0a0f1e" : "#94a3b8", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              {q / 1000}k
            </button>
          ))}
        </div>
      </div>

      {/* Expiry */}
      <div style={{ background: "#0a0f1e", border: "1px solid #1e2d50", borderRadius: 10, padding: 12 }}>
        <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 6 }}>Tempo de expiração</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          {EXPIRY_OPTIONS.map(opt => (
            <button key={opt.secs} onClick={() => setExpiry(opt)}
              style={{ flex: 1, height: 34, background: expiry.secs === opt.secs ? "#f5a623" : "#1e2d50", color: expiry.secs === opt.secs ? "#0a0f1e" : "#94a3b8", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              {opt.label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "#94a3b8", fontSize: 11, whiteSpace: "nowrap" }}>Personalizado:</span>
          <div style={{ position: "relative", flex: 1 }}>
            <input type="number" min={1} max={59}
              value={Math.round(expiry.secs / 60) || ""}
              onChange={e => {
                const mins = Math.max(1, Math.min(59, parseInt(e.target.value) || 1));
                setExpiry({ label: `${mins} min`, secs: mins * 60 });
              }}
              style={{ width: "100%", background: "#111827", border: "1px solid #1e2d50", borderRadius: 6, padding: "6px 36px 6px 10px", color: "#fff", fontSize: 13, fontWeight: 700, outline: "none", boxSizing: "border-box" }} />
            <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontSize: 11 }}>min</span>
          </div>
        </div>
      </div>

      {/* Payout */}
      <div style={{ background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.25)", borderRadius: 8, padding: "9px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "#94a3b8", fontSize: 12 }}>Retorno potencial</span>
        <span style={{ color: "#f5a623", fontWeight: 800, fontSize: 14 }}>+{formatKz(profit)} (85%)</span>
      </div>
      {bnaRate && (
        <div style={{ textAlign: "center", color: "#4b5563", fontSize: 11 }}>
          1 USD = {bnaRate.toLocaleString("pt-AO")} Kz
        </div>
      )}

      {/* Sentiment */}
      <div style={{ background: "#0a0f1e", border: "1px solid #1e2d50", borderRadius: 8, padding: "10px 12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 12 }}>
          <span style={{ color: "#22c55e", fontWeight: 700 }}>ALTA {sentiment}%</span>
          <span style={{ color: "#ef4444", fontWeight: 700 }}>{100 - sentiment}% BAIXA</span>
        </div>
        <div style={{ height: 5, background: "#1e2d50", borderRadius: 3, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${sentiment}%`, background: "linear-gradient(90deg,#22c55e,#f5a623)", transition: "width 0.5s", borderRadius: 3 }} />
        </div>
      </div>

      {/* ALTA / BAIXA buttons */}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => openTrade("call")} disabled={loading || currentPrice === 0}
          style={{ flex: 1, height: 56, background: "#22c55e", color: "#fff", border: "none", borderRadius: 10, fontSize: 16, fontWeight: 800, cursor: loading ? "not-allowed" : "pointer", opacity: loading || currentPrice === 0 ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "opacity 0.15s" }}>
          {loading ? "A processar..." : <><TrendingUp size={18} /> ALTA</>}
        </button>
        <button onClick={() => openTrade("put")} disabled={loading || currentPrice === 0}
          style={{ flex: 1, height: 56, background: "#ef4444", color: "#fff", border: "none", borderRadius: 10, fontSize: 16, fontWeight: 800, cursor: loading ? "not-allowed" : "pointer", opacity: loading || currentPrice === 0 ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "opacity 0.15s" }}>
          {loading ? "A processar..." : <><TrendingDown size={18} /> BAIXA</>}
        </button>
      </div>

      {/* Active trades */}
      {activeTrades.length > 0 && (
        <div style={{ background: "#0a0f1e", border: "1px solid #1e2d50", borderRadius: 10, padding: 12 }}>
          <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 8 }}>Operações ativas ({activeTrades.length})</div>
          {activeTrades.map(t => {
            const winning = isTradeWinning(t.direction, t.entryPrice);
            return (
              <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: winning ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)", border: `1px solid ${winning ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.35)"}`, borderRadius: 8, padding: "8px 10px", marginBottom: 6, transition: "border-color 0.4s, background 0.4s" }}>
                <div>
                  <div style={{ color: "#fff", fontSize: 12, fontWeight: 600 }}>{t.asset}</div>
                  <div style={{ color: t.direction === "call" ? "#22c55e" : "#ef4444", fontSize: 11 }}>
                    {t.direction === "call" ? "▲ ALTA" : "▼ BAIXA"} · {formatKz(t.amount)}
                  </div>
                  <div style={{ color: winning ? "#22c55e" : "#ef4444", fontSize: 10, fontWeight: 800, marginTop: 2 }}>
                    {currentPrice === 0 ? "—" : winning ? "● GANHO" : "● PERDA"}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: "#f5a623", fontWeight: 700, fontSize: 13 }}>{getCountdown(t)}</div>
                  <div style={{ color: "#94a3b8", fontSize: 10 }}>restante</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Recent wins */}
      {recentWins.length > 0 && (
        <div style={{ background: "#0a0f1e", border: "1px solid #1e2d50", borderRadius: 10, padding: 12 }}>
          <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 6 }}>Vitórias recentes</div>
          {recentWins.map((w, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: "#94a3b8" }}>{w.name}</span>
              <span style={{ color: "#22c55e", fontWeight: 600 }}>+{formatKz(w.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  ); }

  // ── Asset dropdown (shared) ──────────────────────────────────────────────
  const AssetDropdown = ({ mobile = false }: { mobile?: boolean }) => (
    <div style={{ position: "relative" }}>
      <button onClick={() => setAssetDropdown(!assetDropdown)}
        style={{ background: "#0a0f1e", border: "1px solid #1e2d50", borderRadius: 8, padding: mobile ? "5px 10px" : "6px 12px", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: mobile ? 4 : 6, fontSize: mobile ? 13 : 14, fontWeight: 700 }}>
        {selectedPair?.label ?? "…"} <ChevronDown size={mobile ? 12 : 14} color="#94a3b8" />
      </button>
      {assetDropdown && (
        <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, background: "#111827", border: "1px solid #1e2d50", borderRadius: 10, minWidth: mobile ? 180 : 220, zIndex: 300, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
          {pairs.map(p => (
            <button key={p.symbol}
              onClick={() => { setSelectedPair(p); setAssetDropdown(false); }}
              style={{ width: "100%", background: selectedPair?.symbol === p.symbol ? "#1e2d50" : "transparent", border: "none", padding: mobile ? "12px 14px" : "10px 14px", color: "#fff", cursor: "pointer", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, minHeight: 48 }}>
              <span style={{ fontWeight: 600 }}>{p.label}</span>
              <span style={{ color: "#94a3b8", fontSize: 11 }}>{p.category}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  if (status === "loading" || !selectedPair) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0f1e", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#f5a623", fontSize: 18, fontFamily: "system-ui, sans-serif" }}>A carregar...</div>
      </div>
    );
  }

  // ── MOBILE RENDER ─────────────────────────────────────────────────────────
  if (isMobile) {
    const TOPBAR_H    = 52;
    const TICKER_H    = 28;
    const TF_H        = 38;
    const BOTTOMNAV_H = 60;
    const CONTENT_TOP = TOPBAR_H + TICKER_H + TF_H;
    const chartH      = windowHeight > 0 ? windowHeight - CONTENT_TOP - BOTTOMNAV_H : 400;

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
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: TOPBAR_H, zIndex: 110, background: "#111827", borderBottom: "1px solid #1e2d50", display: "flex", alignItems: "center", padding: "0 8px", gap: 5 }}>
          {/* Logo + brand */}
          <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
            <div style={{ width: 26, height: 26, background: "#f5a623", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <TrendingUp size={14} color="#0a0f1e" strokeWidth={2.5} />
            </div>
            <span style={{ color: "#fff", fontWeight: 800, fontSize: 13, whiteSpace: "nowrap" }}>Dynamics</span>
          </div>

          {/* Asset selector */}
          <AssetDropdown mobile />

          <div style={{ flex: 1 }} />

          {/* Reload demo */}
          {isDemo && demoBalance < 5000 && (
            <button onClick={resetDemo} disabled={demoReloading}
              style={{ background: "transparent", border: "1px solid #f5a623", color: "#f5a623", borderRadius: 5, fontSize: 10, padding: "2px 6px", cursor: demoReloading ? "not-allowed" : "pointer", opacity: demoReloading ? 0.6 : 1, whiteSpace: "nowrap", flexShrink: 0 }}>
              {demoReloading ? "..." : "↺"}
            </button>
          )}

          {/* Notification bell */}
          <NotificationBell />

          {/* Balance — click to toggle demo/real */}
          <button onClick={toggleAccount}
            style={{ background: "#0a0f1e", border: `1px solid ${isDemo ? "rgba(245,166,35,0.4)" : "rgba(34,197,94,0.4)"}`, borderRadius: 7, padding: "4px 8px", display: "flex", alignItems: "center", gap: 4, cursor: "pointer", flexShrink: 0 }}>
            <Wallet size={11} color="#f5a623" />
            <span style={{ color: "#fff", fontWeight: 700, fontSize: 11 }}>{formatKz(Math.floor(displayBalance))}</span>
            <span style={{ background: isDemo ? "rgba(245,166,35,0.2)" : "rgba(34,197,94,0.2)", color: isDemo ? "#f5a623" : "#22c55e", borderRadius: 3, fontSize: 9, padding: "1px 4px", fontWeight: 800, letterSpacing: 0.3 }}>
              {isDemo ? "D" : "R"}
            </span>
          </button>

          {/* Avatar + dropdown */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <button onClick={() => setUserMenuOpen(!userMenuOpen)}
              style={{ width: 28, height: 28, background: "#f5a623", borderRadius: "50%", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <User size={14} color="#0a0f1e" />
            </button>
            {userMenuOpen && (
              <div style={{ position: "absolute", top: "110%", right: 0, background: "#111827", border: "1px solid #1e2d50", borderRadius: 10, minWidth: 168, zIndex: 500, boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
                <div style={{ padding: "10px 12px", borderBottom: "1px solid #1e2d50" }}>
                  <div style={{ color: "#fff", fontWeight: 600, fontSize: 13 }}>{session?.user?.name}</div>
                  <div style={{ color: "#94a3b8", fontSize: 11 }}>{session?.user?.email}</div>
                </div>
                <a href="/profile"   onClick={() => setUserMenuOpen(false)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", color: "#94a3b8", textDecoration: "none", fontSize: 13 }}><User size={13} /> Perfil</a>
                <a href="/dashboard" onClick={() => setUserMenuOpen(false)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", color: "#94a3b8", textDecoration: "none", fontSize: 13 }}><BarChart2 size={13} /> Dashboard</a>
                <a href="/wallet"    onClick={() => setUserMenuOpen(false)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", color: "#94a3b8", textDecoration: "none", fontSize: 13 }}><Wallet size={13} /> Carteira</a>
                <button onClick={() => signOut({ callbackUrl: "/login" })}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", color: "#ef4444", background: "none", border: "none", cursor: "pointer", fontSize: 13 }}>
                  <LogOut size={13} /> Sair
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Ticker bar ── */}
        <div style={{ position: "fixed", top: TOPBAR_H, left: 0, right: 0, height: TICKER_H, zIndex: 109, background: "#0d1526", borderBottom: "1px solid #1e2d50", overflow: "hidden", display: "flex", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 24, padding: "0 12px", animation: "ticker 20s linear infinite", whiteSpace: "nowrap" }}>
            {[...pairs, ...pairs].map((p, i) => {
              const price = tickerPrices[p.symbol] ?? 0;
              const seed  = SEED_PRICES[p.symbol] ?? 1;
              const isUp  = price >= seed;
              return (
                <span key={i} style={{ fontSize: 11, color: "#94a3b8" }}>
                  <span style={{ color: "#fff", fontWeight: 600 }}>{p.label} </span>
                  <span style={{ color: isUp ? "#22c55e" : "#ef4444" }}>
                    {price > 0 ? price.toFixed(p.decimals) : "—"}
                  </span>
                </span>
              );
            })}
          </div>
          <style>{`@keyframes ticker { from { transform:translateX(0) } to { transform:translateX(-50%) } }`}</style>
        </div>

        {/* ── Timeframe strip ── */}
        <div style={{ position: "fixed", top: TOPBAR_H + TICKER_H, left: 0, right: 0, height: TF_H, zIndex: 108, background: "#111827", borderBottom: "1px solid #1e2d50", display: "flex", alignItems: "center", padding: "0 12px", gap: 6 }}>
          {["1m", "5m", "15m", "1h", "1D"].map(tf => (
            <button key={tf} onClick={() => setTimeframe(tf)}
              style={{ background: timeframe === tf ? "#f5a623" : "transparent", color: timeframe === tf ? "#0a0f1e" : "#94a3b8", border: `1px solid ${timeframe === tf ? "#f5a623" : "#1e2d50"}`, borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              {tf}
            </button>
          ))}
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
            {candleTimer && (
              <span style={{ fontSize: 11, fontWeight: 700, color: "#f5a623", background: "rgba(245,166,35,0.12)", border: "1px solid rgba(245,166,35,0.3)", borderRadius: 5, padding: "2px 6px", fontVariantNumeric: "tabular-nums" }}>
                ⏱ {candleTimer}
              </span>
            )}
            <span style={{ fontSize: 14, fontWeight: 700, color: priceUp ? "#22c55e" : "#ef4444" }}>
              {priceUp ? "▲" : "▼"} {priceStr}
            </span>
          </div>
        </div>

        {/* ── Chart ── */}
        <div ref={chartRef} style={{ position: "fixed", top: CONTENT_TOP, left: 0, right: 0, height: chartH, background: "#070d1c", overflow: "hidden" }} />

        {/* ── Bottom nav ── */}
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: BOTTOMNAV_H, zIndex: 110, background: "#111827", borderTop: "1px solid #1e2d50", display: "flex", alignItems: "center" }}>
          {([
            { id: "chart",   label: "Gráfico",  Icon: BarChart2   },
            { id: "trade",   label: "Negociar", Icon: DollarSign  },
            { id: "wallet",  label: "Carteira", Icon: Wallet      },
            { id: "account", label: "Conta",    Icon: User        },
          ] as const).map(({ id, label, Icon }) => (
            <button key={id} onClick={() => {
              if (id === "wallet")  { router.push("/wallet");  return; }
              if (id === "account") { router.push("/profile"); return; }
              if (id === "trade")   { setMobileTab("trade"); setTradeDrawer(true); return; }
              setMobileTab("chart"); setTradeDrawer(false);
            }}
              style={{ flex: 1, height: "100%", background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3 }}>
              <Icon size={22} color={mobileTab === id ? "#f5a623" : "#64748b"} />
              <span style={{ fontSize: 10, fontWeight: 600, color: mobileTab === id ? "#f5a623" : "#64748b" }}>{label}</span>
            </button>
          ))}
        </div>

        {/* ── Drawer backdrop ── */}
        {tradeDrawer && (
          <div onClick={() => { setTradeDrawer(false); setMobileTab("chart"); }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200 }} />
        )}

        {/* ── Trade drawer ── */}
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 300, height: "82vh", background: "#111827", borderRadius: "16px 16px 0 0", transform: tradeDrawer ? "translateY(0)" : "translateY(100%)", transition: "transform 0.3s cubic-bezier(0.32,0.72,0,1)", display: "flex", flexDirection: "column", boxShadow: "0 -8px 40px rgba(0,0,0,0.6)" }}>
          <div style={{ padding: "12px 0 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <div style={{ width: 36, height: 4, background: "#374151", borderRadius: 2 }} />
            <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px" }}>
              <div>
                <span style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>Abrir Operação</span>
                <span style={{ marginLeft: 8, color: "#94a3b8", fontSize: 12 }}>{selectedPair?.label}</span>
              </div>
              <button onClick={() => { setTradeDrawer(false); setMobileTab("chart"); }}
                style={{ background: "#1e2d50", border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={16} color="#94a3b8" />
              </button>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px 24px" }}>
            {renderTradePanel(true)}
          </div>
        </div>
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
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 56, zIndex: 100, background: "#111827", borderBottom: "1px solid #1e2d50", display: "flex", alignItems: "center", padding: "0 16px", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 160 }}>
          <div style={{ width: 32, height: 32, background: "#f5a623", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <TrendingUp size={18} color="#0a0f1e" strokeWidth={2.5} />
          </div>
          <span style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>Dynamics Works</span>
        </div>

        <AssetDropdown />

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: priceUp ? "#22c55e" : "#ef4444" }}>{priceStr}</span>
          {priceUp ? <TrendingUp size={16} color="#22c55e" /> : <TrendingDown size={16} color="#ef4444" />}
        </div>

        <div style={{ flex: 1 }} />

        <button onClick={toggleAccount}
          style={{ background: isDemo ? "rgba(245,166,35,0.15)" : "rgba(34,197,94,0.15)", border: `1px solid ${isDemo ? "rgba(245,166,35,0.4)" : "rgba(34,197,94,0.4)"}`, borderRadius: 8, padding: "5px 12px", color: isDemo ? "#f5a623" : "#22c55e", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
          {isDemo ? "DEMO" : "REAL"}
        </button>

        <Clock size={16} color="#94a3b8" />
        <span style={{ color: "#94a3b8", fontSize: 13, minWidth: 44 }}>{clockStr}</span>

        <NotificationBell />

        <div style={{ background: "#0a0f1e", border: "1px solid #1e2d50", borderRadius: 8, padding: "5px 12px", display: "flex", alignItems: "center", gap: 6 }}>
          <Wallet size={14} color="#f5a623" />
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>{formatKz(Math.floor(displayBalance))}</span>
        </div>
        {isDemo && demoBalance < 5000 && (
          <button onClick={resetDemo} disabled={demoReloading}
            style={{ background: "transparent", border: "1px solid #f5a623", color: "#f5a623", borderRadius: 6, fontSize: 11, padding: "3px 8px", cursor: demoReloading ? "not-allowed" : "pointer", opacity: demoReloading ? 0.6 : 1, whiteSpace: "nowrap" }}>
            {demoReloading ? "A recarregar..." : "↺ Recarregar"}
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
      <div style={{ position: "fixed", top: 56, left: 0, right: 0, height: 32, zIndex: 99, background: "#0d1526", borderBottom: "1px solid #1e2d50", overflow: "hidden", display: "flex", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 32, padding: "0 20px", animation: "ticker 30s linear infinite", whiteSpace: "nowrap" }}>
          {[...pairs, ...pairs].map((p, i) => {
            const price = tickerPrices[p.symbol] ?? 0;
            const seed  = SEED_PRICES[p.symbol] ?? 1;
            const isUp  = price >= seed;
            return (
              <span key={i} style={{ fontSize: 12, color: "#94a3b8" }}>
                <span style={{ color: "#fff", fontWeight: 600 }}>{p.label} </span>
                <span style={{ color: isUp ? "#22c55e" : "#ef4444" }}>
                  {price > 0 ? price.toFixed(p.decimals) : "—"}
                </span>
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
          <div style={{ padding: "8px 16px", background: "#111827", display: "flex", gap: 6, borderBottom: "1px solid #1e2d50" }}>
            {["1m", "5m", "15m", "1h", "1D"].map(tf => (
              <button key={tf} onClick={() => setTimeframe(tf)}
                style={{ background: timeframe === tf ? "#f5a623" : "transparent", color: timeframe === tf ? "#0a0f1e" : "#94a3b8", border: `1px solid ${timeframe === tf ? "#f5a623" : "#1e2d50"}`, borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                {tf}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            {candleTimer && (
              <span style={{ fontSize: 12, fontWeight: 700, color: "#f5a623", background: "rgba(245,166,35,0.12)", border: "1px solid rgba(245,166,35,0.3)", borderRadius: 5, padding: "3px 8px", fontVariantNumeric: "tabular-nums" }}>
                ⏱ {candleTimer}
              </span>
            )}
          </div>
          <div ref={chartRef} style={{ flex: 1, minHeight: 0 }} />
        </div>

        {/* Right panel 30% */}
        <div style={{ flex: "0 0 30%", overflowY: "auto", padding: 16, background: "#0d1526" }}>
          {renderTradePanel()}
        </div>
      </div>
    </div>
  );
}
