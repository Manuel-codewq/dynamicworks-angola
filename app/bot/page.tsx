"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, Bot, Play, Square, AlertTriangle,
  TrendingUp, TrendingDown, Settings, Activity,
  CheckCircle, XCircle, Clock, Zap,
} from "lucide-react";
import { derivWS, DerivCandle, FOREX_PAIRS, SYNTHETIC_PAIRS, CRYPTO_PAIRS } from "@/lib/derivWebSocket";
import { formatKz } from "@/lib/format";

// ── Tipos ─────────────────────────────────────────────────────────────────────

type Strategy = "rsi" | "ma_cross" | "bbands";
type LogEntry  = { time: string; type: "signal" | "trade" | "info" | "warn"; msg: string; direction?: "call" | "put"; result?: "win" | "loss" | "pending" };

interface BotConfig {
  pair:         string;
  symbol:       string;
  strategy:     Strategy;
  timeframe:    "1m" | "5m" | "15m";
  amountKz:     number;
  expirySecs:   number;
  isDemo:       boolean;
  maxTradesDay: number;
  stopLossKz:   number;
  // RSI params
  rsiPeriod:    number;
  rsiOB:        number; // overbought
  rsiOS:        number; // oversold
  // MA Cross params
  maFast:       number;
  maSlow:       number;
  // Bollinger params
  bbPeriod:     number;
  bbStdDev:     number;
}

const DEFAULT: BotConfig = {
  pair: "EUR/USD OTC", symbol: "1HZ10V",
  strategy: "rsi", timeframe: "1m",
  amountKz: 5000, expirySecs: 60, isDemo: true,
  maxTradesDay: 10, stopLossKz: 20000,
  rsiPeriod: 14, rsiOB: 70, rsiOS: 30,
  maFast: 9, maSlow: 21,
  bbPeriod: 20, bbStdDev: 2,
};

// ── Indicadores ───────────────────────────────────────────────────────────────

function calcRSI(closes: number[], period: number): number | null {
  if (closes.length < period + 1) return null;
  const slice = closes.slice(-period - 1);
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i < slice.length; i++) {
    const d = slice[i] - slice[i-1];
    if (d > 0) avgGain += d; else avgLoss += Math.abs(d);
  }
  avgGain /= period; avgLoss /= period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function calcSMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function calcEMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  const k = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
  }
  return ema;
}

function calcBB(closes: number[], period: number, stdDevMult: number) {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  const sma   = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + (b - sma) ** 2, 0) / period;
  const std   = Math.sqrt(variance);
  return { upper: sma + stdDevMult * std, lower: sma - stdDevMult * std, mid: sma };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ts() { return new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit", second: "2-digit" }); }

const ALL_PAIRS = [
  ...SYNTHETIC_PAIRS.map(p => ({ label: p.label, symbol: p.symbol, group: "OTC 24/7" })),
  ...FOREX_PAIRS.map(p => ({ label: p.label, symbol: p.symbol, group: "Forex" })),
  ...CRYPTO_PAIRS.map(p => ({ label: p.label, symbol: p.symbol, group: "Cripto" })),
];

const GRANULARITY_MAP: Record<string, number> = { "1m": 60, "5m": 300, "15m": 900 };

const EXPIRY_OPTIONS = [
  { label: "30s", value: 30 }, { label: "1m", value: 60 }, { label: "2m", value: 120 },
  { label: "3m", value: 180 }, { label: "5m", value: 300 }, { label: "10m", value: 600 },
];

// ── Componente principal ──────────────────────────────────────────────────────

export default function BotPage() {
  const { status, data: session } = useSession();
  const router = useRouter();

  const [cfg,      setCfg]      = useState<BotConfig>(DEFAULT);
  const [running,  setRunning]  = useState(false);
  const [log,      setLog]      = useState<LogEntry[]>([]);
  const [candles,  setCandles]  = useState<DerivCandle[]>([]);
  const [tradesDay,setTradesDay]= useState(0);
  const [pnlDay,   setPnlDay]   = useState(0);
  const [tab,      setTab]      = useState<"config" | "log">("config");
  const [activeTradeId, setActiveTradeId] = useState<string | null>(null);

  const runningRef        = useRef(false);
  const cfgRef            = useRef(cfg);
  const candlesRef        = useRef<DerivCandle[]>([]);
  const lastSignalCandle  = useRef<number>(0);   // epoch do último candle que gerou trade
  const tradesDayRef      = useRef(0);
  const pnlDayRef         = useRef(0);
  const activeTradeRef    = useRef<string | null>(null);
  const activeTradeTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { if (status === "unauthenticated") router.push("/login"); }, [status, router]);

  // Persistir config
  useEffect(() => {
    try {
      const saved = localStorage.getItem("dw_bot_cfg");
      if (saved) setCfg(JSON.parse(saved));
    } catch {}
  }, []);

  function updateCfg<K extends keyof BotConfig>(key: K, value: BotConfig[K]) {
    setCfg(prev => {
      const next = { ...prev, [key]: value };
      if (key === "pair") {
        const found = ALL_PAIRS.find(p => p.label === String(value));
        if (found) next.symbol = found.symbol;
      }
      try { localStorage.setItem("dw_bot_cfg", JSON.stringify(next)); } catch {}
      cfgRef.current = next;
      return next;
    });
  }

  const addLog = useCallback((entry: Omit<LogEntry, "time">) => {
    setLog(prev => [{ ...entry, time: ts() }, ...prev].slice(0, 100));
  }, []);

  // ── Lógica de sinal ──────────────────────────────────────────────────────────

  const checkSignal = useCallback((closes: number[]): "call" | "put" | null => {
    const c = cfgRef.current;
    const last = closes[closes.length - 1];

    if (c.strategy === "rsi") {
      const rsi    = calcRSI(closes, c.rsiPeriod);
      const rsiPrev = calcRSI(closes.slice(0, -1), c.rsiPeriod);
      if (rsi === null || rsiPrev === null) return null;
      if (rsiPrev <= c.rsiOS && rsi > c.rsiOS) return "call";
      if (rsiPrev >= c.rsiOB && rsi < c.rsiOB) return "put";
      return null;
    }

    if (c.strategy === "ma_cross") {
      const fastNow  = calcEMA(closes, c.maFast);
      const slowNow  = calcEMA(closes, c.maSlow);
      const fastPrev = calcEMA(closes.slice(0, -1), c.maFast);
      const slowPrev = calcEMA(closes.slice(0, -1), c.maSlow);
      if (!fastNow || !slowNow || !fastPrev || !slowPrev) return null;
      if (fastPrev <= slowPrev && fastNow > slowNow) return "call";
      if (fastPrev >= slowPrev && fastNow < slowNow) return "put";
      return null;
    }

    if (c.strategy === "bbands") {
      const bb     = calcBB(closes, c.bbPeriod, c.bbStdDev);
      const bbPrev = calcBB(closes.slice(0, -1), c.bbPeriod, c.bbStdDev);
      if (!bb || !bbPrev) return null;
      const prevClose = closes[closes.length - 2];
      if (prevClose <= bbPrev.lower && last > bb.lower) return "call";
      if (prevClose >= bbPrev.upper && last < bb.upper) return "put";
      return null;
    }

    return null;
  }, []);

  // ── Abrir trade via API ──────────────────────────────────────────────────────

  const openTrade = useCallback(async (direction: "call" | "put") => {
    const c = cfgRef.current;

    if (tradesDayRef.current >= c.maxTradesDay) {
      addLog({ type: "warn", msg: `Limite de ${c.maxTradesDay} trades/dia atingido — bot parado.` });
      stopBot();
      return;
    }
    if (pnlDayRef.current <= -c.stopLossKz) {
      addLog({ type: "warn", msg: `Stop loss de ${formatKz(c.stopLossKz)} atingido — bot parado.` });
      stopBot();
      return;
    }
    if (activeTradeRef.current) return; // já há trade activa

    try {
      const res = await fetch("/api/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asset: c.pair, symbol: c.symbol,
          direction, amount: c.amountKz,
          expirySecs: c.expirySecs,
          skipTournament: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        addLog({ type: "warn", msg: `Erro ao abrir trade: ${data.error}` });
        return;
      }

      const id = data.id as string;
      activeTradeRef.current = id;
      setActiveTradeId(id);
      tradesDayRef.current += 1;
      setTradesDay(tradesDayRef.current);

      const dir = direction === "call" ? "▲ CALL" : "▼ PUT";
      addLog({ type: "trade", msg: `Trade aberta — ${dir} · ${formatKz(c.amountKz)} · ${c.expirySecs}s`, direction });

      // Verificar resultado após expiração
      if (activeTradeTimer.current) clearTimeout(activeTradeTimer.current);
      activeTradeTimer.current = setTimeout(async () => {
        await checkTradeResult(id);
      }, (c.expirySecs + 3) * 1000);

    } catch (e: any) {
      addLog({ type: "warn", msg: `Falha de rede ao abrir trade.` });
    }
  }, [addLog]);

  async function checkTradeResult(id: string) {
    try {
      const res  = await fetch(`/api/trade/${id}/close`, { method: "POST" });
      const data = await res.json();
      if (!res.ok && res.status !== 404) return;

      const result  = data?.result as string | undefined;
      const profit  = data?.profit as number | undefined ?? 0;
      const isWin   = result === "win";

      pnlDayRef.current += profit;
      setPnlDay(pnlDayRef.current);
      activeTradeRef.current = null;
      setActiveTradeId(null);

      addLog({
        type: "trade",
        msg: isWin
          ? `✓ Ganho — +${formatKz(Math.floor(profit))}`
          : `✗ Perda — −${formatKz(Math.floor(Math.abs(profit)))}`,
        result: isWin ? "win" : "loss",
      });
    } catch {
      activeTradeRef.current = null;
      setActiveTradeId(null);
    }
  }

  // ── Candle handler ───────────────────────────────────────────────────────────

  const handleCandles = useCallback((sym: string, incoming: DerivCandle[]) => {
    if (!runningRef.current) return;
    if (sym !== cfgRef.current.symbol) return;

    candlesRef.current = incoming;
    setCandles([...incoming]);

    const last = incoming[incoming.length - 1];
    if (!last || last.epoch === lastSignalCandle.current) return;

    const closes = incoming.map(c => c.close);
    const signal = checkSignal(closes);

    if (signal) {
      lastSignalCandle.current = last.epoch;
      const dir = signal === "call" ? "▲ CALL" : "▼ PUT";
      addLog({ type: "signal", msg: `Sinal detectado — ${dir}`, direction: signal });
      openTrade(signal);
    }
  }, [checkSignal, openTrade, addLog]);

  // ── Start / Stop ─────────────────────────────────────────────────────────────

  function startBot() {
    runningRef.current = true;
    cfgRef.current     = cfg;
    tradesDayRef.current = 0;
    pnlDayRef.current    = 0;
    setTradesDay(0); setPnlDay(0);
    setRunning(true);
    setCandles([]);
    candlesRef.current = [];
    lastSignalCandle.current = 0;

    addLog({ type: "info", msg: `Bot iniciado — ${cfg.pair} · ${cfg.strategy.toUpperCase()} · ${cfg.timeframe} · ${cfg.isDemo ? "Demo" : "Real"}` });

    derivWS.connect();
    derivWS.onCandles(handleCandles);
    derivWS.getCandles(cfg.symbol, GRANULARITY_MAP[cfg.timeframe], 200);

    // Actualizar candles a cada timeframe
    const interval = setInterval(() => {
      if (!runningRef.current) { clearInterval(interval); return; }
      derivWS.getCandles(cfgRef.current.symbol, GRANULARITY_MAP[cfgRef.current.timeframe], 200);
    }, GRANULARITY_MAP[cfg.timeframe] * 1000);
  }

  function stopBot() {
    runningRef.current = false;
    setRunning(false);
    if (activeTradeTimer.current) clearTimeout(activeTradeTimer.current);
    addLog({ type: "info", msg: "Bot parado." });
  }

  useEffect(() => () => { runningRef.current = false; }, []);

  // ── Indicadores actuais ──────────────────────────────────────────────────────

  const closes = candles.map(c => c.close);
  const rsiNow = closes.length > 0 ? calcRSI(closes, cfg.rsiPeriod) : null;
  const maNow  = closes.length > 0 ? { fast: calcEMA(closes, cfg.maFast), slow: calcEMA(closes, cfg.maSlow) } : null;
  const bbNow  = closes.length > 0 ? calcBB(closes, cfg.bbPeriod, cfg.bbStdDev) : null;
  const lastPrice = closes[closes.length - 1];

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: "#070d1c", fontFamily: "system-ui,-apple-system,sans-serif", paddingBottom: 60 }}>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        .bot-inp { background:#0a0f1e; border:1px solid #1e2d50; border-radius:9px; padding:9px 12px; color:#fff; font-size:13px; outline:none; width:100%; box-sizing:border-box; }
        .bot-inp:focus { border-color:rgba(245,166,35,.5); box-shadow:0 0 0 3px rgba(245,166,35,.1); }
        .bot-sel { background:#0a0f1e; border:1px solid #1e2d50; border-radius:9px; padding:9px 12px; color:#fff; font-size:13px; outline:none; width:100%; box-sizing:border-box; appearance:none; cursor:pointer; }
        .bot-sel:focus { border-color:rgba(245,166,35,.5); box-shadow:0 0 0 3px rgba(245,166,35,.1); }
      `}</style>

      {/* Header */}
      <div style={{ background:"#0d1528", borderBottom:"1px solid rgba(30,45,80,.6)", padding:"14px 20px", display:"flex", alignItems:"center", gap:12, position:"sticky", top:0, zIndex:10, backdropFilter:"blur(12px)" }}>
        <button onClick={() => router.back()} style={{ background:"rgba(255,255,255,.05)", border:"1px solid rgba(30,45,80,.5)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", width:36, height:36, borderRadius:9, color:"#94a3b8" }}>
          <ChevronLeft size={18} />
        </button>
        <Bot size={18} color="#f5a623" />
        <span style={{ color:"#fff", fontWeight:800, fontSize:16, flex:1 }}>Bot de Trading</span>
        {running && (
          <span style={{ background:"rgba(34,197,94,.12)", border:"1px solid rgba(34,197,94,.3)", color:"#22c55e", borderRadius:20, padding:"4px 12px", fontSize:12, fontWeight:700, display:"flex", alignItems:"center", gap:5 }}>
            <span style={{ width:7, height:7, borderRadius:"50%", background:"#22c55e", display:"inline-block", animation:"pulse 1.4s ease infinite" }} />
            ACTIVO
          </span>
        )}
      </div>

      <div style={{ maxWidth:900, margin:"0 auto", padding:"20px 16px", animation:"fadeUp .4s ease both" }}>

        {/* Aviso demo */}
        {cfg.isDemo && (
          <div style={{ background:"rgba(245,166,35,.06)", border:"1px solid rgba(245,166,35,.2)", borderRadius:12, padding:"10px 16px", marginBottom:16, display:"flex", alignItems:"center", gap:10 }}>
            <AlertTriangle size={15} color="#f5a623" style={{ flexShrink:0 }} />
            <span style={{ color:"#f5a623", fontSize:13 }}>Modo Demo — as operações não usam saldo real. Activa conta Real na configuração.</span>
          </div>
        )}

        {/* Tabs mobile */}
        <div style={{ display:"flex", gap:4, background:"rgba(17,24,39,.8)", border:"1px solid rgba(30,45,80,.5)", borderRadius:10, padding:4, marginBottom:16, width:"fit-content" }}>
          {(["config","log"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ padding:"7px 20px", borderRadius:7, border:"none", fontSize:13, fontWeight:700, cursor:"pointer", background: tab === t ? "#f5a623" : "transparent", color: tab === t ? "#0a0f1e" : "#64748b" }}>
              {t === "config" ? "Configuração" : "Log"}
            </button>
          ))}
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }} className="bot-grid">
          <style>{`@media(max-width:720px){.bot-grid{grid-template-columns:1fr!important}}`}</style>

          {/* ── Painel Config ──────────────────────────────────────────────── */}
          <div style={{ display: tab === "log" ? "none" : "flex", flexDirection:"column", gap:12 }} className="bot-cfg">
            <style>{`@media(min-width:721px){.bot-cfg{display:flex!important}}`}</style>

            <Section title="Par & Modo">
              <Label>Par de trading</Label>
              <select className="bot-sel" value={cfg.pair} onChange={e => updateCfg("pair", e.target.value)} disabled={running}>
                {["OTC 24/7","Forex","Cripto"].map(g => (
                  <optgroup key={g} label={g}>
                    {ALL_PAIRS.filter(p => p.group === g).map(p => (
                      <option key={p.symbol} value={p.label}>{p.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:8 }}>
                <div>
                  <Label>Timeframe</Label>
                  <select className="bot-sel" value={cfg.timeframe} onChange={e => updateCfg("timeframe", e.target.value as any)} disabled={running}>
                    <option value="1m">1 minuto</option>
                    <option value="5m">5 minutos</option>
                    <option value="15m">15 minutos</option>
                  </select>
                </div>
                <div>
                  <Label>Conta</Label>
                  <select className="bot-sel" value={cfg.isDemo ? "demo" : "real"} onChange={e => updateCfg("isDemo", e.target.value === "demo")} disabled={running}>
                    <option value="demo">Demo</option>
                    <option value="real">Real</option>
                  </select>
                </div>
              </div>
            </Section>

            <Section title="Trade">
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                <div>
                  <Label>Valor por trade (Kz)</Label>
                  <input type="number" className="bot-inp" min={1000} max={500000} step={1000}
                    value={cfg.amountKz} onChange={e => updateCfg("amountKz", Number(e.target.value))} disabled={running} />
                </div>
                <div>
                  <Label>Expiração</Label>
                  <select className="bot-sel" value={cfg.expirySecs} onChange={e => updateCfg("expirySecs", Number(e.target.value))} disabled={running}>
                    {EXPIRY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:8 }}>
                <div>
                  <Label>Máx. trades/dia</Label>
                  <input type="number" className="bot-inp" min={1} max={100}
                    value={cfg.maxTradesDay} onChange={e => updateCfg("maxTradesDay", Number(e.target.value))} disabled={running} />
                </div>
                <div>
                  <Label>Stop loss diário (Kz)</Label>
                  <input type="number" className="bot-inp" min={1000} step={1000}
                    value={cfg.stopLossKz} onChange={e => updateCfg("stopLossKz", Number(e.target.value))} disabled={running} />
                </div>
              </div>
            </Section>

            <Section title="Estratégia">
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6, marginBottom:14 }}>
                {([
                  { id:"rsi",      label:"RSI",       desc:"Sobrecomprado/vendido" },
                  { id:"ma_cross", label:"MA Cross",  desc:"Cruzamento de médias"  },
                  { id:"bbands",   label:"Bollinger", desc:"Toque nas bandas"      },
                ] as { id: Strategy; label: string; desc: string }[]).map(s => (
                  <button key={s.id} onClick={() => !running && updateCfg("strategy", s.id)}
                    disabled={running}
                    style={{ padding:"10px 8px", borderRadius:10, border:`1px solid ${cfg.strategy === s.id ? "#f5a623" : "rgba(30,45,80,.5)"}`, background: cfg.strategy === s.id ? "rgba(245,166,35,.1)" : "rgba(17,24,39,.6)", cursor: running ? "not-allowed" : "pointer", textAlign:"center" }}>
                    <div style={{ color: cfg.strategy === s.id ? "#f5a623" : "#94a3b8", fontWeight:700, fontSize:12 }}>{s.label}</div>
                    <div style={{ color:"#334155", fontSize:10, marginTop:2 }}>{s.desc}</div>
                  </button>
                ))}
              </div>

              {cfg.strategy === "rsi" && (
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
                  <div><Label>Período</Label><input type="number" className="bot-inp" min={2} max={50} value={cfg.rsiPeriod} onChange={e => updateCfg("rsiPeriod", Number(e.target.value))} disabled={running} /></div>
                  <div><Label>Sobrecomprado</Label><input type="number" className="bot-inp" min={50} max={95} value={cfg.rsiOB} onChange={e => updateCfg("rsiOB", Number(e.target.value))} disabled={running} /></div>
                  <div><Label>Sobrevendido</Label><input type="number" className="bot-inp" min={5} max={50} value={cfg.rsiOS} onChange={e => updateCfg("rsiOS", Number(e.target.value))} disabled={running} /></div>
                </div>
              )}
              {cfg.strategy === "ma_cross" && (
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                  <div><Label>EMA Rápida</Label><input type="number" className="bot-inp" min={2} max={50} value={cfg.maFast} onChange={e => updateCfg("maFast", Number(e.target.value))} disabled={running} /></div>
                  <div><Label>EMA Lenta</Label><input type="number" className="bot-inp" min={5} max={200} value={cfg.maSlow} onChange={e => updateCfg("maSlow", Number(e.target.value))} disabled={running} /></div>
                </div>
              )}
              {cfg.strategy === "bbands" && (
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                  <div><Label>Período</Label><input type="number" className="bot-inp" min={5} max={50} value={cfg.bbPeriod} onChange={e => updateCfg("bbPeriod", Number(e.target.value))} disabled={running} /></div>
                  <div><Label>Desvio-padrão</Label><input type="number" className="bot-inp" min={1} max={4} step={0.5} value={cfg.bbStdDev} onChange={e => updateCfg("bbStdDev", Number(e.target.value))} disabled={running} /></div>
                </div>
              )}
            </Section>

            {/* Botão Start/Stop */}
            <button onClick={running ? stopBot : startBot}
              style={{ width:"100%", background: running ? "rgba(239,68,68,.12)" : "linear-gradient(135deg,#f5a623,#f97316)", color: running ? "#ef4444" : "#0a0f1e", border: running ? "1px solid rgba(239,68,68,.3)" : "none", borderRadius:12, padding:"16px", fontSize:15, fontWeight:800, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8, transition:"all .18s", boxShadow: running ? "none" : "0 6px 24px rgba(245,166,35,.3)" }}>
              {running ? <><Square size={17} fill="#ef4444" /> Parar Bot</> : <><Play size={17} fill="#0a0f1e" /> Iniciar Bot</>}
            </button>
          </div>

          {/* ── Painel Log / Status ────────────────────────────────────────── */}
          <div style={{ display: tab === "config" ? "none" : "flex", flexDirection:"column", gap:12 }} className="bot-log">
            <style>{`@media(min-width:721px){.bot-log{display:flex!important}}`}</style>

            {/* Stats */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
              {[
                { label:"Trades hoje", value: String(tradesDay), color:"#38bdf8" },
                { label:"P&L hoje", value: formatKz(Math.floor(Math.abs(pnlDay))), color: pnlDay >= 0 ? "#22c55e" : "#ef4444", prefix: pnlDay > 0 ? "+" : pnlDay < 0 ? "−" : "" },
                { label:"Velas", value: String(candles.length), color:"#a78bfa" },
              ].map(s => (
                <div key={s.label} style={{ background:"rgba(17,24,39,.8)", border:"1px solid rgba(30,45,80,.5)", borderRadius:12, padding:"12px 10px", textAlign:"center" }}>
                  <div style={{ color:s.color, fontWeight:900, fontSize:16 }}>{(s.prefix ?? "") + s.value}</div>
                  <div style={{ color:"#475569", fontSize:10, marginTop:3 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Indicadores actuais */}
            {candles.length > 0 && (
              <div style={{ background:"rgba(17,24,39,.8)", border:"1px solid rgba(30,45,80,.5)", borderRadius:12, padding:"14px 16px" }}>
                <div style={{ color:"#64748b", fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:.5, marginBottom:12 }}>Indicadores (vela actual)</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                  {lastPrice && (
                    <Chip label="Preço" value={lastPrice.toPrecision(6)} color="#fff" />
                  )}
                  {cfg.strategy === "rsi" && rsiNow !== null && (
                    <Chip label={`RSI(${cfg.rsiPeriod})`} value={rsiNow.toFixed(1)}
                      color={rsiNow > cfg.rsiOB ? "#ef4444" : rsiNow < cfg.rsiOS ? "#22c55e" : "#94a3b8"} />
                  )}
                  {cfg.strategy === "ma_cross" && maNow && (
                    <>
                      <Chip label={`EMA(${cfg.maFast})`} value={maNow.fast?.toPrecision(6) ?? "—"} color="#38bdf8" />
                      <Chip label={`EMA(${cfg.maSlow})`} value={maNow.slow?.toPrecision(6) ?? "—"} color="#a78bfa" />
                    </>
                  )}
                  {cfg.strategy === "bbands" && bbNow && (
                    <>
                      <Chip label="BB Upper" value={bbNow.upper.toPrecision(6)} color="#ef4444" />
                      <Chip label="BB Mid"   value={bbNow.mid.toPrecision(6)}   color="#94a3b8" />
                      <Chip label="BB Lower" value={bbNow.lower.toPrecision(6)} color="#22c55e" />
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Trade activa */}
            {activeTradeId && (
              <div style={{ background:"rgba(245,166,35,.08)", border:"1px solid rgba(245,166,35,.3)", borderRadius:12, padding:"12px 16px", display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ width:8, height:8, borderRadius:"50%", background:"#f5a623", display:"inline-block", animation:"pulse 1s ease infinite", flexShrink:0 }} />
                <span style={{ color:"#f5a623", fontSize:13, fontWeight:700 }}>Trade activa — a aguardar resultado...</span>
              </div>
            )}

            {/* Log */}
            <div style={{ background:"rgba(17,24,39,.8)", border:"1px solid rgba(30,45,80,.5)", borderRadius:12, padding:"14px 16px", flex:1 }}>
              <div style={{ color:"#64748b", fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:.5, marginBottom:12 }}>Log de actividade</div>
              {log.length === 0 ? (
                <div style={{ color:"#334155", fontSize:13, textAlign:"center", padding:"24px 0" }}>
                  Inicia o bot para ver a actividade aqui.
                </div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:6, maxHeight:320, overflowY:"auto" }}>
                  {log.map((e, i) => (
                    <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start", padding:"6px 0", borderBottom:"1px solid rgba(30,45,80,.2)" }}>
                      <span style={{ color:"#334155", fontSize:10, fontFamily:"monospace", flexShrink:0, marginTop:1 }}>{e.time}</span>
                      <span style={{ color:
                        e.type === "signal" ? (e.direction === "call" ? "#22c55e" : "#ef4444") :
                        e.type === "trade"  ? (e.result === "win" ? "#22c55e" : e.result === "loss" ? "#ef4444" : "#f5a623") :
                        e.type === "warn"   ? "#ef4444" : "#64748b",
                        fontSize:12, lineHeight:1.5
                      }}>{e.msg}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background:"rgba(17,24,39,.8)", border:"1px solid rgba(30,45,80,.5)", borderRadius:14, padding:"16px 18px" }}>
      <div style={{ color:"#64748b", fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:.5, marginBottom:12 }}>{title}</div>
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ color:"#64748b", fontSize:11, fontWeight:600, marginBottom:5, textTransform:"uppercase", letterSpacing:.4 }}>{children}</div>;
}

function Chip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background:"rgba(30,45,80,.4)", border:"1px solid rgba(30,45,80,.6)", borderRadius:8, padding:"5px 10px", display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
      <span style={{ color:"#475569", fontSize:9, fontWeight:600 }}>{label}</span>
      <span style={{ color, fontSize:12, fontWeight:700 }}>{value}</span>
    </div>
  );
}
