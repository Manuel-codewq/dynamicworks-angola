'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  ColorType,
  AreaSeries,
  CandlestickSeries,
  LineStyle,
} from 'lightweight-charts';
import { useStore } from '@/store';
import { derivAPI } from '@/lib/deriv';
import { Lock, Clock, TrendingUp, ArrowUpRight, Calendar, Wifi } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Candle { time: number; open: number; high: number; low: number; close: number; }
type Granularity = 60 | 300 | 900 | 3600;

const TIMEFRAMES: { label: string; gran: Granularity }[] = [
  { label: '1m',  gran: 60   },
  { label: '5m',  gran: 300  },
  { label: '15m', gran: 900  },
  { label: '1h',  gran: 3600 },
];

// ── ChartWidget ────────────────────────────────────────────────────────────────
export default function ChartWidget() {
  const containerRef      = useRef<HTMLDivElement>(null);
  const chartRef          = useRef<IChartApi | null>(null);
  const seriesRef         = useRef<ISeriesApi<any> | null>(null);
  const candleMapRef      = useRef<Map<number, Candle>>(new Map());
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const initializedRef    = useRef(false);
  const upperLineRef      = useRef<any>(null);
  const lowerLineRef      = useRef<any>(null);
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [timeframe,      setTimeframe]      = useState<Granularity>(60);
  const [barriers,       setBarriers]       = useState<{ upper: number; lower: number } | null>(null);
  const [barrierLoading, setBL]             = useState(false);
  const [isLoading,      setIsLoading]      = useState(true);
  const [wsError,        setWsError]        = useState(false);
  const [marketClosed,   setMarketClosed]   = useState(false);
  const [closedReason,   setClosedReason]   = useState('');

  const chartType   = useStore(s => s.chartType);
  const setChartType = useStore(s => s.setChartType);
  const activeAsset = useStore(s => s.activeAsset);
  const tradeMode   = useStore(s => s.tradeMode);
  const stakeAmount = useStore(s => s.stakeAmount);
  const growthRate  = useStore(s => s.percentageGrowthTarget);

  // ── Barrier fetch ─────────────────────────────────────────────────────────
  const fetchBarriers = useCallback(() => {
    if (tradeMode !== 'ACCU') { setBarriers(null); return; }
    setBL(true);
    derivAPI.send({
      proposal:      1,
      amount:        stakeAmount,
      basis:         'stake',
      contract_type: 'ACCU',
      currency:      'USD',
      growth_rate:   growthRate / 100,
      symbol:        activeAsset.sym,
    });
  }, [tradeMode, stakeAmount, growthRate, activeAsset.sym]);

  // ── Listen for proposal (barrier) and error messages ─────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;

      if (detail.msg_type === 'proposal' && detail.proposal?.barrier) {
        setBarriers({
          upper: parseFloat(detail.proposal.barrier),
          lower: parseFloat(detail.proposal.low_barrier ?? detail.proposal.barrier),
        });
        setBL(false);
      }

      if (detail.msg_type === 'error' && detail.error?.code === 'DisabledFunction') {
        // Barreiras indisponíveis para este ativo — silenciar
        setBL(false);
      }
    };
    window.addEventListener('deriv-msg', handler);
    return () => window.removeEventListener('deriv-msg', handler);
  }, []);

  // ── WebSocket connection state ────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.msg_type === 'error') {
        // Só marcar erro crítico se não for proposal error
        if (detail.error?.code !== 'DisabledFunction') {
          setWsError(false); // reset em cada mensagem válida
        }
      } else if (detail?.msg_type) {
        setWsError(false);
      }
    };
    window.addEventListener('deriv-msg', handler);

    const timeout = setTimeout(() => {
      if (isLoading) setWsError(true);
    }, 12_000);

    return () => {
      window.removeEventListener('deriv-msg', handler);
      clearTimeout(timeout);
    };
  }, [isLoading]);

  useEffect(() => {
    fetchBarriers();
    const iv = setInterval(fetchBarriers, 12_000);
    return () => clearInterval(iv);
  }, [fetchBarriers]);

  // ── Update barrier price lines when barriers change ───────────────────────
  useEffect(() => {
    if (!seriesRef.current) return;

    if (upperLineRef.current) { try { seriesRef.current.removePriceLine(upperLineRef.current); } catch { /* */ } upperLineRef.current = null; }
    if (lowerLineRef.current) { try { seriesRef.current.removePriceLine(lowerLineRef.current); } catch { /* */ } lowerLineRef.current = null; }

    if (tradeMode !== 'ACCU' || !barriers) return;

    upperLineRef.current = seriesRef.current.createPriceLine({
      price:            barriers.upper,
      color:            '#00e676',
      lineWidth:        1,
      lineStyle:        LineStyle.Dashed,
      axisLabelVisible: true,
      title:            '▲ Barreira',
    });
    lowerLineRef.current = seriesRef.current.createPriceLine({
      price:            barriers.lower,
      color:            '#ff3d5a',
      lineWidth:        1,
      lineStyle:        LineStyle.Dashed,
      axisLabelVisible: true,
      title:            '▼ Barreira',
    });
  }, [barriers, tradeMode]);

  // ── Build / rebuild chart ─────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    setIsLoading(true);
    setWsError(false);

    // Safety timeout — hide loading after 6s even if history never arrives
    if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    loadingTimeoutRef.current = setTimeout(() => setIsLoading(false), 6_000);

    // Cleanup previous
    resizeObserverRef.current?.disconnect();
    if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }
    seriesRef.current = null;
    upperLineRef.current = null;
    lowerLineRef.current = null;
    candleMapRef.current.clear();
    initializedRef.current = false;

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor:  'rgba(140,170,200,0.7)',
        fontSize:   11,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.025)' },
        horzLines: { color: 'rgba(255,255,255,0.025)' },
      },
      rightPriceScale: {
        borderColor:  'rgba(255,255,255,0.06)',
        scaleMargins: { top: 0.25, bottom: 0.2 },
        minimumWidth: 72,
        autoScale:    true,
      },
      timeScale: {
        borderColor:    'rgba(255,255,255,0.06)',
        timeVisible:    true,
        secondsVisible: chartType === 'AREA',
        rightOffset:    14,
        barSpacing:     chartType === 'AREA' ? 3 : 8,
        minBarSpacing:  1,
        fixLeftEdge:    false,
        fixRightEdge:   false,
      },
      crosshair: {
        vertLine: { color: 'rgba(255,255,255,0.15)', labelBackgroundColor: '#1a2035' },
        horzLine: { color: 'rgba(255,255,255,0.15)', labelBackgroundColor: '#1a2035' },
      },
      handleScroll: {
        mouseWheel:       true,
        pressedMouseMove: true,
        horzTouchDrag:    true,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel:           true,
        pinch:                true,
      },
      width:  container.clientWidth  || 600,
      height: container.clientHeight || 400,
    });

    chartRef.current = chart;

    const precision  = activeAsset?.pip ?? 4;
    const minMove    = 1 / Math.pow(10, precision);
    const priceFormat = { type: 'price' as const, precision, minMove };

    let series: ISeriesApi<any>;

    if (chartType === 'AREA') {
      series = chart.addSeries(AreaSeries, {
        lineColor:   '#00d4ff',
        topColor:    'rgba(0,212,255,0.18)',
        bottomColor: 'rgba(0,212,255,0.00)',
        lineWidth:   2,
        crosshairMarkerRadius: 4,
        priceFormat,
        lastValueVisible: true,
        priceLineVisible: true,
      });
    } else {
      series = chart.addSeries(CandlestickSeries, {
        upColor:       '#00e676',
        downColor:     '#ff3d5a',
        borderVisible: false,
        wickUpColor:   '#00e676',
        wickDownColor: '#ff3d5a',
        priceFormat,
        lastValueVisible: true,
      });
    }
    seriesRef.current = series;

    // ── History via backend (pre-fetch + cache) ──────────────────────────────
    const loadHistory = async () => {
      // Limpar estado anterior
      setMarketClosed(false);
      setClosedReason('');
      try {
        const res = await fetch(`/api/chart-data?sym=${activeAsset.sym}&style=ticks&gran=${timeframe}`);

        // 502 = backend não conseguiu ligar à Deriv (timeout ou mercado fechado)
        if (!res.ok) {
          if (tradeMode === 'RISE_FALL') {
            setMarketClosed(true);
            setClosedReason('Mercado Rise/Fall indisponível neste momento');
          }
          return;
        }

        const result = await res.json();
        const hist = result.data as { times?: number[]; prices?: string[]; _closed?: boolean; _reason?: string } | undefined;

        // Sem dados ou mercado fechado explicitamente
        if (!hist || !hist.times?.length || hist._closed) {
          if (tradeMode === 'RISE_FALL') {
            setMarketClosed(true);
            setClosedReason(hist?._reason ?? 'Fora do horário de mercado');
          }
          return;
        }

        // Mercado aberto — limpar aviso anterior
        setMarketClosed(false);
        setClosedReason('');

        if (!seriesRef.current || !chartRef.current) return;

        if (chartType === 'AREA') {
          const data = hist.times.map((t, i) => ({ time: t as any, value: parseFloat(hist.prices![i]) }));
          seriesRef.current.setData(data);
        } else {
          // Construir candles dos ticks do backend
          candleMapRef.current.clear();
          const buckets = new Map<number, Candle>();
          for (let i = 0; i < hist.times.length; i++) {
            const t = hist.times[i];
            const p = parseFloat(hist.prices![i]);
            const bucketT = Math.floor(t / timeframe) * timeframe;
            const existing = buckets.get(bucketT);
            if (existing) {
              existing.high  = Math.max(existing.high, p);
              existing.low   = Math.min(existing.low, p);
              existing.close = p;
            } else {
              buckets.set(bucketT, { time: bucketT, open: p, high: p, low: p, close: p });
            }
          }
          const sorted = [...buckets.values()].sort((a, b) => a.time - b.time);
          sorted.forEach(c => candleMapRef.current.set(c.time, c));
          seriesRef.current.setData(sorted.map(c => ({ ...c, time: c.time as any })));
        }

        if (!initializedRef.current && chartRef.current) {
          chartRef.current.timeScale().fitContent();
          initializedRef.current = true;
        }
      } catch (err) {
        // Erro de rede — se Rise/Fall, assumir mercado fechado
        if (tradeMode === 'RISE_FALL') {
          setMarketClosed(true);
          setClosedReason('Sem ligação ao servidor da Deriv');
        } else {
          console.warn('[Chart] Fetch histórico falhou, usando ticks ao vivo:', err);
        }
      } finally {
        setIsLoading(false);
      }
    };
    loadHistory();

    // ── Live ticks ───────────────────────────────────────────────────────────
    derivAPI.subscribeTicks(activeAsset.sym, (tick: any) => {
      if (!seriesRef.current) return;

      // Remove loading overlay on first live tick
      setIsLoading(false);
      if (loadingTimeoutRef.current) { clearTimeout(loadingTimeoutRef.current); loadingTimeoutRef.current = null; }
      const epoch = parseInt(tick.epoch);
      const price = parseFloat(tick.quote);

      if (chartType === 'AREA') {
        seriesRef.current.update({ time: epoch as any, value: price });

      } else {
        const bucketT  = Math.floor(epoch / timeframe) * timeframe;
        const map      = candleMapRef.current;
        const existing = map.get(bucketT);

        if (existing) {
          existing.high  = Math.max(existing.high,  price);
          existing.low   = Math.min(existing.low,   price);
          existing.close = price;
          const { time: _t1, ...rest1 } = existing;
          seriesRef.current.update({ time: bucketT as any, ...rest1 });
        } else {
          const sortedKeys = [...map.keys()].sort((a, b) => b - a);
          const prevClose  = sortedKeys.length ? (map.get(sortedKeys[0])?.close ?? price) : price;
          const candle: Candle = { time: bucketT, open: prevClose, high: price, low: price, close: price };
          map.set(bucketT, candle);
          const { time: _t2, ...rest2 } = candle;
          seriesRef.current.update({ time: bucketT as any, ...rest2 });
        }
      }
    });

    // ── ResizeObserver ───────────────────────────────────────────────────────
    resizeObserverRef.current = new ResizeObserver(() => {
      if (container && chartRef.current) {
        chartRef.current.resize(
          container.clientWidth,
          container.clientHeight || 400
        );
      }
    });
    resizeObserverRef.current.observe(container);

    return () => {
      resizeObserverRef.current?.disconnect();
      chartRef.current?.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [chartType, activeAsset.sym, timeframe]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#0a0e17', overflow: 'hidden' }}>

      {/* ── Loading Overlay ── */}
      {isLoading && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 50,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(10,14,23,0.85)', backdropFilter: 'blur(4px)',
          gap: '12px',
        }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '50%',
            border: '3px solid rgba(0,212,255,0.15)',
            borderTopColor: '#00d4ff',
            animation: 'spin 0.8s linear infinite',
          }} />
          <span style={{ fontSize: '0.65rem', color: 'rgba(0,212,255,0.6)', fontFamily: 'var(--mono)', letterSpacing: '2px' }}>
            A CARREGAR {activeAsset.name}…
          </span>
        </div>
      )}

      {/* ── WebSocket Error Overlay ── */}
      {wsError && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 50,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(10,14,23,0.9)', backdropFilter: 'blur(4px)',
          gap: '12px',
        }}>
          <div style={{ fontSize: '2rem' }}>📡</div>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--red)' }}>Sem ligação à API</span>
          <span style={{ fontSize: '0.62rem', color: 'var(--text3)', textAlign: 'center', maxWidth: '200px' }}>
            A tentar reconectar automaticamente...
          </span>
          <button onClick={() => { setWsError(false); setIsLoading(true); derivAPI.connect(); }}
            style={{ marginTop: '8px', padding: '8px 20px', borderRadius: '8px', background: 'var(--accent)', color: '#000', fontWeight: 800, border: 'none', cursor: 'pointer', fontSize: '0.72rem' }}>
            Reconectar
          </button>
        </div>
      )}

      {/* ── Market Closed — Compact Banner ── */}
      {marketClosed && !wsError && (
        <div style={{
          position: 'absolute', top: '44px', left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 50, width: 'calc(100% - 24px)', maxWidth: '420px',
          background: 'rgba(8,12,20,0.96)',
          border: '1px solid rgba(245,158,11,0.25)',
          borderRadius: '14px',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(245,158,11,0.08)',
          padding: '12px 14px',
          animation: 'slideDown 0.25s ease-out',
        }}>

          {/* Linha 1 — Ícone + Título + Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            {/* Ícone pulsante */}
            <div style={{ position: 'relative', width: '34px', height: '34px', flexShrink: 0 }}>
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                border: '1px solid rgba(245,158,11,0.3)',
                animation: 'pulse 2.5s ease-in-out infinite',
              }} />
              <div style={{
                position: 'absolute', inset: '5px', borderRadius: '50%',
                background: 'rgba(245,158,11,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Lock size={14} color="#f59e0b" strokeWidth={2.5} />
              </div>
            </div>

            {/* Texto */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
                Mercado Fechado
              </div>
              <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                <TrendingUp size={9} />
                {activeAsset.name} — Rise / Fall
              </div>
            </div>

            {/* Badge fechado */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '4px 10px', borderRadius: '99px', fontSize: '0.58rem', fontWeight: 800,
              background: 'rgba(255,61,90,0.1)', color: 'var(--red)',
              border: '1px solid rgba(255,61,90,0.2)', flexShrink: 0,
            }}>
              <Wifi size={9} strokeWidth={2.5} />
              FECHADO
            </div>
          </div>

          {/* Linha 2 — Motivo + Horário + Botão */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
            {/* Motivo */}
            <div style={{
              flex: 1, padding: '7px 10px',
              background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.14)',
              borderRadius: '9px', display: 'flex', alignItems: 'center', gap: '7px',
            }}>
              <Clock size={11} color="#f59e0b" strokeWidth={2} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.4 }}>
                {closedReason || 'Fora do horário de mercado'}
              </span>
            </div>

            {/* Horário */}
            <div style={{
              padding: '7px 10px',
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '9px', fontSize: '0.58rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
                <Calendar size={9} color="rgba(255,255,255,0.3)" />
                <span style={{ color: 'rgba(255,255,255,0.25)', letterSpacing: '0.5px', textTransform: 'uppercase', fontSize: '0.52rem' }}>Horário</span>
              </div>
              <div style={{ color: '#f59e0b', fontWeight: 700, fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>Dom–Sex</div>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>22:00–21:59 UTC</div>
            </div>

            {/* Botão */}
            <div
              onClick={() => setMarketClosed(false)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                padding: '7px 12px', borderRadius: '9px', fontSize: '0.6rem', fontWeight: 700,
                background: 'rgba(0,212,255,0.08)', color: 'var(--accent)',
                border: '1px solid rgba(0,212,255,0.18)',
                cursor: 'pointer', flexShrink: 0,
                flexDirection: 'column',
              }}
            >
              <ArrowUpRight size={13} strokeWidth={2.5} />
              <span style={{ fontSize: '0.52rem', whiteSpace: 'nowrap' }}>ACCU</span>
            </div>
          </div>

        </div>
      )}

      {/* ── Chart Type Toggle ── */}
      <div style={{
        position: 'absolute', top: 44, left: tradeMode === 'ACCU' && barriers ? 120 : 8, zIndex: 20,
        display: 'flex', gap: 3,
      }}>
        {(['AREA', 'CANDLE'] as const).map(type => (
          <button key={type} onClick={() => setChartType(type)} style={{
            padding: '3px 9px', borderRadius: 6, fontSize: '0.58rem',
            fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--mono)',
            border: '1px solid',
            background:  chartType === type ? 'rgba(124,58,237,0.2)' : 'rgba(0,0,0,0.55)',
            color:       chartType === type ? '#a78bfa' : 'rgba(255,255,255,0.3)',
            borderColor: chartType === type ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.07)',
            transition:  'all 0.15s',
          }}>
            {type === 'AREA' ? '〜 Linha' : '📊 Velas'}
          </button>
        ))}
      </div>

      {/* ── Timeframe tabs — candle mode only ── */}
      {chartType === 'CANDLE' && (
        <div style={{
          position: 'absolute', top: 44, right: 8, zIndex: 20,
          display: 'flex', gap: 3,
        }}>
          {TIMEFRAMES.map(tf => (
            <button key={tf.gran} onClick={() => setTimeframe(tf.gran)} style={{
              padding: '3px 8px', borderRadius: 6, fontSize: '0.58rem',
              fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--mono)',
              border: '1px solid',
              background:  timeframe === tf.gran ? 'rgba(0,212,255,0.18)' : 'rgba(0,0,0,0.55)',
              color:       timeframe === tf.gran ? '#00d4ff' : 'rgba(255,255,255,0.3)',
              borderColor: timeframe === tf.gran ? 'rgba(0,212,255,0.4)' : 'rgba(255,255,255,0.07)',
              transition:  'all 0.15s',
            }}>
              {tf.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Barrier badges — ACCU mode ── */}
      {tradeMode === 'ACCU' && barriers && (
        <div style={{
          position: 'absolute', top: 44, left: 8, zIndex: 20,
          display: 'flex', flexDirection: 'column', gap: 3,
        }}>
          <span style={{
            background: 'rgba(0,230,118,0.12)', border: '1px solid rgba(0,230,118,0.35)',
            borderRadius: 6, padding: '3px 9px', fontSize: '0.58rem',
            fontFamily: 'var(--mono)', fontWeight: 700, color: '#00e676',
          }}>
            ▲ {barriers.upper.toFixed(activeAsset.pip)}
          </span>
          <span style={{
            background: 'rgba(255,61,90,0.12)', border: '1px solid rgba(255,61,90,0.35)',
            borderRadius: 6, padding: '3px 9px', fontSize: '0.58rem',
            fontFamily: 'var(--mono)', fontWeight: 700, color: '#ff3d5a',
          }}>
            ▼ {barriers.lower.toFixed(activeAsset.pip)}
          </span>
          {barrierLoading && <span style={{ fontSize: '0.45rem', color: 'rgba(255,255,255,0.2)', textAlign: 'center' }}>↻</span>}
        </div>
      )}

      {/* Chart canvas — top:40 leaves room for ChartTopBar overlay */}
      <div
        ref={containerRef}
        style={{ position: 'absolute', top: 40, left: 0, right: 0, bottom: 0 }}
      />
    </div>
  );
}