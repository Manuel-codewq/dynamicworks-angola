'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  ChevronDown, Zap, ClipboardList, User, LogOut, History,
  LineChart, Activity, Store, LayoutDashboard, TrendingUp, TrendingDown,
  Clock, DollarSign, Bell, Bot, CheckCircle, XCircle, BarChart2, X,
} from 'lucide-react';
import { useStore } from '@/store';
import { derivAPI } from '@/lib/deriv';
import { ASSETS_AVAILABLE, ACCU_ASSETS, RISE_FALL_ASSETS } from '@/lib/constants';
import { saveTradeResult, getUserProfile, updateUserProfile, COUNTRIES, UserProfile } from '@/lib/firebase-db';
import RankingView from '@/components/RankingView';

const ChartWidget = dynamic(() => import('@/components/ChartWidget'), { ssr: false });

type NavView    = 'trade' | 'assets' | 'profile' | 'ranking';
type TradeTab   = 'controls' | 'history';

export default function TradingDashboard({ onLogout }: { onLogout: () => void }) {
  const [mobileNav, setMobileNav]   = useState<NavView>('trade');
  const [isMobile, setIsMobile]     = useState(false);
  const [tradeTab, setTradeTab]     = useState<TradeTab>('controls');
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [toast, setToast]           = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  // Profile verification
  const [userProfile, setUserProfile]   = useState<UserProfile | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [editName, setEditName]     = useState('');
  const [editCountry, setEditCountry] = useState('');
  const [editPhone, setEditPhone]   = useState('');

  // Tick buffer for AI analysis
  const tickBuffer = useRef<number[]>([]);

  // Ref para handleTradeExec — evita stale closure no keydown
  const tradeExecRef = useRef<(type: 'ACCU' | 'CALL' | 'PUT') => void>(() => {});

  // Screen detection
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 900);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Store
  const acct          = useStore(s => s.acct);
  const balanceUsd    = useStore(s => s.balanceUsd);
  const isDemo        = useStore(s => s.isDemo);
  const spot          = useStore(s => s.currentSpot);
  const dir           = useStore(s => s.currentDirection);
  const tradeMode     = useStore(s => s.tradeMode);
  const activeAsset   = useStore(s => s.activeAsset);
  const setMode       = useStore(s => s.setMode);
  const setAsset      = useStore(s => s.setAsset);
  const stakeAmount   = useStore(s => s.stakeAmount);
  const duration      = useStore(s => s.duration);
  const durationUnit  = useStore(s => s.durationUnit);
  const setStakeAmount    = useStore(s => s.setStakeAmount);
  const setDuration       = useStore(s => s.setDuration);
  const setGrowthTarget   = useStore(s => s.setGrowthTarget);
  const openContracts     = useStore(s => s.openContracts);
  const growthRate        = useStore(s => s.percentageGrowthTarget);
  const tradeHistory      = useStore(s => s.tradeHistory);
  const aiActive          = useStore(s => s.aiActive);
  const aiSignal          = useStore(s => s.aiSignal);
  const aiConfidence      = useStore(s => s.aiConfidence);
  const setAiActive       = useStore(s => s.setAiActive);
  const setAiSignal       = useStore(s => s.setAiSignal);
  const notifications     = useStore(s => s.notifications);
  const clearNotification = useStore(s => s.clearNotification);

  const unreadCount = notifications.length;

  // ── Connect (ChartWidget trata da subscrição de ticks) ───────────────────────
  useEffect(() => {
    derivAPI.connect();
    const onKey = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT') return;
      if (e.key.toLowerCase() === 'c') tradeExecRef.current('CALL');
      if (e.key.toLowerCase() === 'p') tradeExecRef.current('PUT');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeAsset.sym]);

  // ── Request browser notification permission ──────────────────────────────────
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // ── Listen for API errors (ex: saldo insuficiente, token inválido) ───────────
  useEffect(() => {
    const onApiError = (e: Event) => {
      const err = (e as CustomEvent).detail as { message?: string; code?: string } | undefined;
      const msg = err?.message ?? 'Erro da API Deriv';
      // Mostrar toast de erro na UI
      setToast({ msg: `⚠️ ${msg}`, type: 'error' });
      setTimeout(() => setToast(null), 5000);
    };
    window.addEventListener('deriv-error', onApiError);
    return () => window.removeEventListener('deriv-error', onApiError);
  }, []);

  // ── Load Firebase profile when account is known ───────────────────────────
  useEffect(() => {
    if (!acct || acct === 'VRTC-DEMO-BYPASS') return;
    getUserProfile(acct).then(p => {
      if (p) {
        setUserProfile(p);
        setEditName(p.displayName || '');
        setEditCountry(p.country || '');
        setEditPhone(p.phone || '');
      }
    });
  }, [acct]);

  // ── Save trade to Firebase when it closes ─────────────────────────────────
  // ── Save trade to Firebase when it closes ─────────────────────────────────
  const prevHistoryLen = useRef(0);
  useEffect(() => {
    if (!acct || isDemo) return;
    if (tradeHistory.length > prevHistoryLen.current) {
      const latest = tradeHistory[0];
      if (latest) {
        saveTradeResult(acct, latest, isDemo);
      }
    }
    prevHistoryLen.current = tradeHistory.length;
  }, [tradeHistory, acct, isDemo]);

  // ── AI Trader: tick analysis ─────────────────────────────────────────────────
  useEffect(() => {
    if (!spot) return;
    tickBuffer.current.push(spot);
    if (tickBuffer.current.length > 30) tickBuffer.current.shift();

    if (!aiActive || tickBuffer.current.length < 10) return;

    // Simple momentum: count rising vs falling ticks
    const buf = tickBuffer.current;
    let ups = 0, downs = 0;
    for (let i = 1; i < buf.length; i++) {
      if (buf[i] > buf[i - 1]) ups++;
      else if (buf[i] < buf[i - 1]) downs++;
    }
    const total = ups + downs;
    if (total === 0) return;

    const upPct   = Math.round((ups   / total) * 100);
    const downPct = Math.round((downs / total) * 100);

    if (upPct >= 65) {
      setAiSignal('up', upPct);
    } else if (downPct >= 65) {
      setAiSignal('down', downPct);
    } else {
      setAiSignal('neutral', Math.max(upPct, downPct));
    }
  }, [spot, aiActive]);

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleTradeExec = useCallback((type: 'ACCU' | 'CALL' | 'PUT') => {
    try {
      derivAPI.buyContract(stakeAmount, type, activeAsset.sym, growthRate, duration, durationUnit);
      const label = type === 'ACCU' ? 'Acumulador' : type === 'CALL' ? 'SUBIDA' : 'DESCIDA';
      showToast(`Ordem ${label}: ${activeAsset.name} ($${stakeAmount})`);
    } catch {
      showToast('Erro ao executar operação', 'error');
    }
  }, [stakeAmount, activeAsset.sym, growthRate, duration, durationUnit, showToast]);

  // Manter ref sempre atualizada para o listener de teclado
  useEffect(() => { tradeExecRef.current = handleTradeExec; }, [handleTradeExec]);

  const handleSellContract = (contractId: number) => {
    try {
      derivAPI.sellContract(contractId);
      showToast('Posição fechada com sucesso');
    } catch {
      showToast('Erro ao fechar posição', 'error');
    }
  };

  /* ─── CHART TOP BAR ─────────────────────────────────────────────────────── */
  const ChartTopBar = () => (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '8px 14px',
      background: 'rgba(6,9,15,0.75)', backdropFilter: 'blur(12px)',
      borderBottom: '1px solid rgba(0,212,255,0.08)',
    }}>
      <div>
        <div style={{ fontWeight: 900, fontSize: '0.95rem' }}>{activeAsset.name}</div>
        <div style={{ fontSize: '0.55rem', opacity: 0.6, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
          <div className="cv-live-dot" />
          {tradeMode === 'ACCU' ? 'Accumulators' : 'Rise / Fall'}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ color: dir === 'down' ? 'var(--red)' : 'var(--green)', fontWeight: 900, fontFamily: 'var(--mono)', fontSize: '1.1rem' }}>
          {spot ? spot.toFixed(activeAsset.pip) : '—'}
        </div>
        <div style={{ fontSize: '0.52rem', opacity: 0.4, fontFamily: 'var(--mono)', marginTop: '2px' }}>
          {dir === 'up' ? '▲' : dir === 'down' ? '▼' : '—'} {activeAsset.sym}
        </div>
      </div>
    </div>
  );

  /* ─── MODE SWITCHER ──────────────────────────────────────────────────────── */
  const ModeSwitcher = () => (
    <div style={{ position: 'absolute', bottom: '10px', left: '10px', display: 'flex', gap: '6px', zIndex: 10 }}>
      <button onClick={() => setMode('ACCU')}
        className={`btn btn-sm ${tradeMode === 'ACCU' ? 'btn-accent' : 'btn-ghost'}`}
        style={{ fontSize: '9px', height: '24px', padding: '0 10px' }}>ACCUMULATOR</button>
      <button onClick={() => setMode('RISE_FALL')}
        className={`btn btn-sm ${tradeMode === 'RISE_FALL' ? '' : 'btn-ghost'}`}
        style={{ fontSize: '9px', height: '24px', padding: '0 10px', ...(tradeMode === 'RISE_FALL' ? { background: 'var(--green)', color: '#000' } : {}) }}>
        RISE / FALL
      </button>
    </div>
  );

  /* ─── AI SIGNAL BADGE ────────────────────────────────────────────────────── */
  const AiBadge = () => {
    if (!aiActive) return null;
    const color = aiSignal === 'up' ? 'var(--green)' : aiSignal === 'down' ? 'var(--red)' : '#f59e0b';
    const label = aiSignal === 'up' ? '▲ SUBIDA' : aiSignal === 'down' ? '▼ DESCIDA' : '◎ NEUTRO';
    return (
      <div style={{
        position: 'absolute', bottom: '10px', right: '10px', zIndex: 10,
        background: 'rgba(0,0,0,0.7)', border: `1px solid ${color}`,
        borderRadius: '8px', padding: '4px 10px',
        display: 'flex', alignItems: 'center', gap: '6px',
      }}>
        <Bot size={12} color={color} />
        <span style={{ fontSize: '0.62rem', color, fontWeight: 800 }}>{label}</span>
        <span style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--mono)' }}>{aiConfidence}%</span>
      </div>
    );
  };

  /* ─── TRADE PANEL WRAPPER — memo: só atualiza quando dados de trading mudam, NÃO em cada tick ── */
  const tradePanelJsx = useMemo(() => (
    <div className="dw-trade-panel">
      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.05)', background: '#0a0e1a' }}>
        <button onClick={() => setTradeTab('controls')} style={{
          flex: 1, padding: '10px', fontSize: '0.65rem', fontWeight: 800,
          border: 'none', cursor: 'pointer', background: 'transparent',
          color: tradeTab === 'controls' ? 'var(--accent)' : 'var(--text3)',
          borderBottom: tradeTab === 'controls' ? '2px solid var(--accent)' : '2px solid transparent',
          fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
        }}>
          <Zap size={12} />TRADE
        </button>
        <button onClick={() => setTradeTab('history')} style={{
          flex: 1, padding: '10px', fontSize: '0.65rem', fontWeight: 800,
          border: 'none', cursor: 'pointer', background: 'transparent',
          color: tradeTab === 'history' ? 'var(--accent)' : 'var(--text3)',
          borderBottom: tradeTab === 'history' ? '2px solid var(--accent)' : '2px solid transparent',
          fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
        }}>
          <History size={12} />HISTÓRICO
          {tradeHistory.length > 0 && (
            <span style={{ background: 'rgba(0,212,255,0.15)', color: 'var(--accent)', borderRadius: '99px', padding: '0 5px', fontSize: '0.55rem' }}>
              {tradeHistory.length}
            </span>
          )}
        </button>
      </div>

      {tradeTab === 'controls' ? (
        /* ── Controls ── */
        <div className="dw-trade-inner">
          <div className="dw-mode-row">
            <button className={`dw-mode-btn ${tradeMode === 'ACCU' ? 'active-accu' : ''}`} onClick={() => setMode('ACCU')}>
              <Zap size={11} style={{ display: 'inline', marginRight: 4 }} />ACCUMULATOR
            </button>
            <button className={`dw-mode-btn ${tradeMode === 'RISE_FALL' ? 'active-rf' : ''}`} onClick={() => setMode('RISE_FALL')}>
              <BarChart2 size={11} style={{ display: 'inline', marginRight: 4 }} />RISE / FALL
            </button>
          </div>

          {tradeMode === 'RISE_FALL' && (
            <div className="dw-ctrl-box">
              <span className="dw-ctrl-lbl"><Clock size={9} style={{ display: 'inline', marginRight: 3 }} />Tempo</span>
              <div className="dw-ctrl-row">
                <button className="dw-step" onClick={() => setDuration(Math.max(1, duration - 1), durationUnit)}>−</button>
                <span className="dw-ctrl-val">{duration}<small> {durationUnit === 't' ? 'Ticks' : durationUnit === 's' ? 'Seg' : 'Min'}</small></span>
                <button className="dw-step" onClick={() => setDuration(duration + 1, durationUnit)}>+</button>
              </div>
              <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
                {(['t', 's', 'm'] as const).map(u => (
                  <button key={u} className={`dw-rate-btn ${durationUnit === u ? 'active' : ''}`}
                    onClick={() => setDuration(duration, u)} style={{ flex: 1 }}>
                    {u === 't' ? 'Ticks' : u === 's' ? 'Seg' : 'Min'}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="dw-ctrl-box">
            <span className="dw-ctrl-lbl"><DollarSign size={9} style={{ display: 'inline', marginRight: 3 }} />Investimento</span>
            <div className="dw-ctrl-row">
              <button className="dw-step" onClick={() => setStakeAmount(Math.max(1, stakeAmount - 1))}>−</button>
              <span className="dw-ctrl-val">${stakeAmount}</span>
              <button className="dw-step" onClick={() => setStakeAmount(stakeAmount + 1)}>+</button>
            </div>
            <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
              {[5, 10, 25, 50, 100].map(v => (
                <button key={v} className={`dw-rate-btn ${stakeAmount === v ? 'active' : ''}`}
                  onClick={() => setStakeAmount(v)} style={{ flex: 1, fontSize: '0.6rem' }}>
                  ${v}
                </button>
              ))}
            </div>
          </div>

          {tradeMode === 'ACCU' && (
            <div className="dw-ctrl-box">
              <span className="dw-ctrl-lbl">Taxa de Crescimento</span>
              <div style={{ display: 'flex', gap: '5px', marginTop: '4px' }}>
                {[1, 2, 3, 4, 5].map(v => (
                  <button key={v} className={`dw-rate-btn ${growthRate === v ? 'active' : ''}`}
                    onClick={() => setGrowthTarget(v)} style={{ flex: 1 }}>{v}%</button>
                ))}
              </div>
            </div>
          )}

          <div className="dw-payout-row">
            <span>Retorno Estimado</span>
            <span style={{ color: 'var(--green)', fontWeight: 800, fontFamily: 'var(--mono)' }}>
              {tradeMode === 'ACCU' ? `+${growthRate}% / tick` : '+95.00%'}
            </span>
          </div>

          <div className="dw-ctrl-box" style={{ border: aiActive ? '1px solid rgba(124,58,237,0.4)' : '1px solid rgba(255,255,255,0.05)', background: aiActive ? 'rgba(124,58,237,0.08)' : '#131c2e' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.62rem', fontWeight: 700, color: aiActive ? '#a78bfa' : 'var(--text3)' }}>
                <Bot size={13} /> I.A. TRADER
              </span>
              <button onClick={() => setAiActive(!aiActive)} style={{
                width: '36px', height: '20px', borderRadius: '10px',
                background: aiActive ? '#7c3aed' : 'rgba(255,255,255,0.1)',
                border: 'none', cursor: 'pointer', position: 'relative', transition: 'all 0.2s',
              }}>
                <div style={{
                  width: '14px', height: '14px', background: '#fff', borderRadius: '50%',
                  position: 'absolute', top: '3px', transition: 'left 0.2s',
                  left: aiActive ? '19px' : '3px',
                }} />
              </button>
            </div>
            {aiActive && (
              <div style={{ marginTop: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '0.58rem', color: 'var(--text3)' }}>Sinal de Mercado</span>
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, fontFamily: 'var(--mono)', color: aiSignal === 'up' ? 'var(--green)' : aiSignal === 'down' ? 'var(--red)' : '#f59e0b' }}>
                    {aiSignal === 'up' ? '▲ SUBIDA' : aiSignal === 'down' ? '▼ DESCIDA' : '◎ NEUTRO'} {aiConfidence}%
                  </span>
                </div>
                <div style={{ height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: '2px', transition: 'width 0.4s, background 0.4s', width: `${aiConfidence}%`, background: aiSignal === 'up' ? 'var(--green)' : aiSignal === 'down' ? 'var(--red)' : '#f59e0b' }} />
                </div>
                <div style={{ fontSize: '0.52rem', color: 'var(--text3)', marginTop: '4px' }}>
                  Baseado nos últimos {Math.min(tickBuffer.current.length, 30)} ticks
                </div>
              </div>
            )}
          </div>

          <div className="dw-exec-row">
            {tradeMode === 'ACCU' ? (
              <button className="dw-exec-btn dw-exec-buy" onClick={() => handleTradeExec('ACCU')} style={{ flex: 1 }}>
                <Zap size={18} /><span>COMPRAR</span><small>ACUMULADOR</small>
              </button>
            ) : (
              <>
                <button className="dw-exec-btn dw-exec-call" onClick={() => handleTradeExec('CALL')}>
                  <TrendingUp size={16} /><span>PARA CIMA</span><small>CALL (C)</small>
                </button>
                <button className="dw-exec-btn dw-exec-put" onClick={() => handleTradeExec('PUT')}>
                  <TrendingDown size={16} /><span>PARA BAIXO</span><small>PUT (P)</small>
                </button>
              </>
            )}
          </div>

          <div className="dw-positions">
            <div className="dw-pos-hdr">
              Operações Ativas
              <span style={{ marginLeft: '6px', background: 'rgba(0,212,255,0.1)', color: 'var(--accent)', borderRadius: '99px', padding: '1px 7px', fontSize: '0.6rem' }}>
                {openContracts.length}
              </span>
            </div>
            {openContracts.length === 0 ? (
              <div className="dw-pos-empty"><History size={24} /><span>Sem operações ativas</span></div>
            ) : (
              openContracts.map(c => {
                const pnl = parseFloat(c.profit ?? '0');
                return (
                  <div key={c.contract_id} className={`dw-pos-card ${pnl >= 0 ? 'win' : 'loss'}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.78rem' }}>{c.display_name}</div>
                        <div style={{ fontSize: '0.58rem', opacity: 0.5 }}>{c.contract_type} · ${c.buy_price}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 900, fontFamily: 'var(--mono)', color: pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                          {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
                        </div>
                      </div>
                    </div>
                    <button onClick={() => handleSellContract(c.contract_id)} className="dw-close-btn" style={{ marginTop: '8px', width: '100%' }}>
                      FECHAR POSIÇÃO
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        /* ── Histórico ── */
        <div style={{ padding: '12px', overflowY: 'auto', flex: 1 }}>
          <div className="dw-pos-hdr" style={{ marginBottom: '10px' }}>
            Histórico
            <span style={{ marginLeft: '6px', background: 'rgba(255,255,255,0.06)', color: 'var(--text3)', borderRadius: '99px', padding: '1px 7px', fontSize: '0.6rem' }}>
              {tradeHistory.length}
            </span>
          </div>
          {tradeHistory.length === 0 ? (
            <div className="dw-pos-empty"><History size={24} /><span>Sem histórico ainda</span></div>
          ) : (
            tradeHistory.map(item => {
              const isWin = item.result === 'win';
              const d = new Date(item.closedAt * 1000);
              const time = `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
              return (
                <div key={item.id} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px', marginBottom: '5px',
                  background: 'rgba(255,255,255,0.02)',
                  border: `1px solid ${isWin ? 'rgba(0,230,118,0.12)' : 'rgba(255,61,90,0.12)'}`,
                  borderLeft: `3px solid ${isWin ? 'var(--green)' : 'var(--red)'}`,
                  borderRadius: '10px',
                }}>
                  <div style={{ width: '30px', height: '30px', borderRadius: '8px', flexShrink: 0, background: isWin ? 'rgba(0,230,118,0.1)' : 'rgba(255,61,90,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {isWin ? <CheckCircle size={16} color="var(--green)" /> : <XCircle size={16} color="var(--red)" />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.symbol}</div>
                    <div style={{ fontSize: '0.58rem', color: 'var(--text3)', marginTop: '2px' }}>{item.type} · ${item.stake} · {time}</div>
                  </div>
                  <div style={{ fontWeight: 900, fontFamily: 'var(--mono)', fontSize: '0.88rem', color: isWin ? 'var(--green)' : 'var(--red)', flexShrink: 0 }}>
                    {isWin ? '+' : ''}{item.pnl.toFixed(2)}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [tradeTab, tradeMode, stakeAmount, duration, durationUnit, growthRate, aiActive, aiSignal, aiConfidence, openContracts, tradeHistory, handleTradeExec, handleSellContract]);

  /* ─── NOTIF PANEL ────────────────────────────────────────────────────────── */
  const NotificationPanel = () => (
    <div style={{
      position: 'fixed', top: '56px', right: '8px', zIndex: 999,
      width: '280px', maxHeight: '400px',
      background: '#111827', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '14px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      overflow: 'hidden', display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 800, fontSize: '0.78rem' }}>Notificações</span>
        <button onClick={() => setShowNotifPanel(false)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer' }}><X size={16} /></button>
      </div>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {notifications.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text3)', fontSize: '0.72rem' }}>
            Sem notificações
          </div>
        ) : (
          notifications.map(n => (
            <div key={n.id} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.03)',
            }}>
              <div style={{ fontSize: '0.75rem', flex: 1, color: n.type === 'win' ? 'var(--green)' : n.type === 'loss' ? 'var(--red)' : 'var(--text)', fontWeight: 600 }}>
                {n.msg}
              </div>
              <button onClick={() => clearNotification(n.id)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', flexShrink: 0 }}>
                <X size={12} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );

  /* ─── ASSETS OVERLAY (memo — não re-monta em cada tick) ─────────────────── */
  const assetsViewJsx = useMemo(() => {
    const list = tradeMode === 'ACCU' ? ACCU_ASSETS : RISE_FALL_ASSETS;
    return (
      <div className="dw-overlay">
        <div className="dw-overlay-hdr">
          <h2>Escolha o Ativo ({tradeMode === 'ACCU' ? 'Indices Continuous' : 'Crash / Boom'})</h2>
          <button className="btn btn-ghost" onClick={() => setMobileNav('trade')}>← Voltar</button>
        </div>
        <div className="dw-assets-grid">
          {list.map(asset => (
            <div key={asset.sym} className={`dw-asset-card ${activeAsset.sym === asset.sym ? 'active' : ''}`}
              onClick={() => { setAsset(asset.sym); setMobileNav('trade'); }}>
              <div>
                <div style={{ fontWeight: 800 }}>{asset.name}</div>
                <div style={{ fontSize: '0.62rem', opacity: 0.4, marginTop: '3px' }}>{asset.sym} · Sintéticos 24/7</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: 'var(--accent)', fontWeight: 800, fontFamily: 'var(--mono)' }}>95%</div>
                <div style={{ fontSize: '0.55rem', opacity: 0.4 }}>Payout</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tradeMode, activeAsset.sym]);

  /* ─── DEPOSIT MODAL ─────────────────────────────────────────────────────── */
  const DepositModal = () => (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={() => setShowDepositModal(false)}>
      <div style={{
        background: '#111827', border: '1px solid rgba(0,212,255,0.15)',
        borderRadius: '20px', padding: '28px', width: '90%', maxWidth: '340px',
        boxShadow: '0 30px 80px rgba(0,0,0,0.6)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 900, fontSize: '1rem', marginBottom: '6px' }}>💵 Depositar Fundos</div>
        <div style={{ fontSize: '0.68rem', color: 'var(--text3)', marginBottom: '20px' }}>
          Esta é uma conta de treino. Os fundos são virtuais e não têm valor real.
        </div>
        {[100, 500, 1000, 5000, 10000].map(v => (
          <button key={v} onClick={() => { showToast(`Demo: $${v.toLocaleString()} adicionados (conta treinamento)`); setShowDepositModal(false); }}
            style={{
              width: '100%', marginBottom: '8px', padding: '12px',
              background: 'rgba(0,212,255,0.07)', border: '1px solid rgba(0,212,255,0.2)',
              borderRadius: '10px', color: 'var(--accent)', fontWeight: 800,
              cursor: 'pointer', fontSize: '0.82rem', fontFamily: 'var(--font)',
              transition: 'all 0.15s',
            }}
          >
            + ${v.toLocaleString()} USD
          </button>
        ))}
        <button onClick={() => setShowDepositModal(false)} style={{
          width: '100%', padding: '10px', marginTop: '4px',
          background: 'transparent', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '10px', color: 'var(--text3)', cursor: 'pointer',
          fontSize: '0.72rem', fontFamily: 'var(--font)',
        }}>Cancelar</button>
      </div>
    </div>
  );


  // useMemo: ProfileView só re-renderiza quando dados de perfil mudam, NÃO em cada tick de preço
  const profileViewJsx = useMemo(() => {
    const wins     = tradeHistory.filter(t => t.result === 'win').length;
    const total    = tradeHistory.length;
    const wr       = total ? Math.round((wins / total) * 100) : 0;
    const totalPnl = tradeHistory.reduce((s, t) => s + t.pnl, 0);
    const radius   = 28;
    const circ     = 2 * Math.PI * radius;
    const dash     = (wr / 100) * circ;
    const isVerified = !!(userProfile?.verified);
    const selectedCountry = COUNTRIES.find(c => c.code === editCountry);

    const handleSaveProfile = async () => {
      if (!acct || !editName.trim()) return;
      setProfileSaving(true);
      try {
        const flag = COUNTRIES.find(c => c.code === editCountry)?.flag ?? '🌍';
        await updateUserProfile(acct, {
          displayName: editName.trim(),
          country: editCountry,
          countryFlag: flag,
          phone: editPhone.trim(),
          isDemo,
        });
        setUserProfile(prev => prev ? { ...prev, displayName: editName, country: editCountry, countryFlag: flag, phone: editPhone, verified: !!(editName && editCountry && editPhone) } : prev);
        showToast('✅ Perfil atualizado com sucesso!');
      } catch {
        showToast('Erro ao guardar perfil', 'error');
      } finally {
        setProfileSaving(false);
      }
    };

    return (
      <div className="dw-overlay">
        <div className="dw-overlay-hdr">
          <h2>Minha Conta</h2>
          <button className="btn btn-ghost" onClick={() => setMobileNav('trade')}>← Voltar</button>
        </div>
        <div style={{ padding: '1rem', overflowY: 'auto', flex: 1 }}>

          {/* Hero */}
          <div className="profile-hero" style={{ marginBottom: '1rem' }}>
            <div className="profile-avatar">
              {selectedCountry ? <span style={{ fontSize: '1.5rem' }}>{selectedCountry.flag}</span> : <User size={28} />}
            </div>
            <div className="profile-info">
              <div className="profile-name">{editName || acct || 'Trader'}</div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '4px' }}>
                <div className="profile-badge">{isDemo ? 'CONTA TREINAMENTO' : 'CONTA REAL'}</div>
                {isVerified && <div style={{ fontSize: '0.55rem', background: 'rgba(0,230,118,0.12)', color: 'var(--green)', border: '1px solid rgba(0,230,118,0.3)', borderRadius: '99px', padding: '2px 8px', fontWeight: 700 }}>✅ Verificado</div>}
              </div>
            </div>
          </div>

          {/* Saldo */}
          <div className="profile-balance-card">
            <div className="pbc-label">Saldo Disponível</div>
            <div className="pbc-value" style={{ fontSize: '2.2rem' }}>${balanceUsd}</div>
            <div className="pbc-btns" style={{ marginTop: '1rem' }}>
              <button className="pbc-btn deposit" onClick={() => setShowDepositModal(true)}>Depositar Fundos</button>
              <button className="pbc-btn withdraw" onClick={() => showToast('Esta funcionalidade está disponível na conta real', 'error')}>Solicitar Saque</button>
            </div>
          </div>

          {/* Verificacao de Perfil */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem', marginTop: '1rem' }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '1rem', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <User size={11} /> Verificar Perfil
              {isVerified && <span style={{ color: 'var(--green)' }}>— Completo</span>}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Nome */}
              <div>
                <label style={{ fontSize: '0.6rem', color: 'var(--text3)', display: 'block', marginBottom: '4px' }}>NOME PÚBLICO (aparece no ranking)</label>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="Ex: João M."
                  maxLength={20}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: '10px', boxSizing: 'border-box',
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                    color: 'white', fontSize: '0.82rem', fontFamily: 'var(--font)', outline: 'none',
                  }}
                />
              </div>

              {/* País */}
              <div>
                <label style={{ fontSize: '0.6rem', color: 'var(--text3)', display: 'block', marginBottom: '4px' }}>PAÍS</label>
                <select
                  value={editCountry}
                  onChange={e => setEditCountry(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: '10px', boxSizing: 'border-box',
                    background: '#131c2e', border: '1px solid rgba(255,255,255,0.1)',
                    color: 'white', fontSize: '0.82rem', fontFamily: 'var(--font)', outline: 'none',
                  }}
                >
                  <option value="">Seleciona o teu país...</option>
                  {COUNTRIES.map(c => (
                    <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
                  ))}
                </select>
              </div>

              {/* Telefone */}
              <div>
                <label style={{ fontSize: '0.6rem', color: 'var(--text3)', display: 'block', marginBottom: '4px' }}>TELEF. (com código do país)</label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={e => setEditPhone(e.target.value)}
                  placeholder="Ex: +244 923 000 000"
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: '10px', boxSizing: 'border-box',
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                    color: 'white', fontSize: '0.82rem', fontFamily: 'var(--font)', outline: 'none',
                  }}
                />
              </div>

              <button
                onClick={handleSaveProfile}
                disabled={profileSaving || !editName.trim()}
                style={{
                  width: '100%', padding: '11px', borderRadius: '10px',
                  background: profileSaving ? 'rgba(0,212,255,0.2)' : 'var(--accent)',
                  border: 'none', color: profileSaving ? 'var(--accent)' : '#000',
                  fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer',
                  fontFamily: 'var(--font)', transition: 'all 0.2s',
                  opacity: (!editName.trim()) ? 0.4 : 1,
                }}
              >
                {profileSaving ? 'A guardar...' : '💾 Guardar Perfil'}
              </button>
            </div>
          </div>

          {/* Win Rate Ring */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem', marginTop: '1rem' }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text3)', marginBottom: '1rem', letterSpacing: '1px' }}>Desempenho (Sessão)</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '12px' }}>
              <svg width={72} height={72} style={{ flexShrink: 0 }}>
                <circle cx={36} cy={36} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={6} />
                <circle cx={36} cy={36} r={radius} fill="none"
                  stroke={wr >= 60 ? 'var(--green)' : wr >= 40 ? '#f59e0b' : 'var(--red)'}
                  strokeWidth={6} strokeDasharray={`${dash} ${circ - dash}`}
                  strokeDashoffset={circ / 4} strokeLinecap="round"
                  style={{ transition: 'stroke-dasharray 0.6s ease' }}
                />
                <text x={36} y={36} textAnchor="middle" dominantBaseline="central"
                  style={{ fill: 'white', fontSize: '13px', fontWeight: 900, fontFamily: 'var(--mono)' }}>
                  {wr}%
                </text>
              </svg>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text3)', marginBottom: '4px' }}>Win Rate</div>
                <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${wr}%`, borderRadius: '3px', background: wr >= 60 ? 'var(--green)' : wr >= 40 ? '#f59e0b' : 'var(--red)', transition: 'width 0.6s ease' }} />
                </div>
                <div style={{ fontSize: '0.58rem', color: 'var(--text3)', marginTop: '4px' }}>{wins} vitórias de {total} operações</div>
              </div>
            </div>
            {[
              { label: 'PnL Total',     value: `${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`, color: totalPnl >= 0 ? 'var(--green)' : 'var(--red)' },
              { label: 'Trades Ativos', value: String(openContracts.length), color: undefined },
              { label: 'Histórico',     value: String(total), color: undefined },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.75rem' }}>
                <span style={{ opacity: 0.5 }}>{row.label}</span>
                <span style={{ fontWeight: 700, fontFamily: 'var(--mono)', color: row.color }}>{row.value}</span>
              </div>
            ))}
          </div>

          <button className="btn btn-outline" style={{ width: '100%', color: 'var(--red)', marginTop: '1.5rem', border: '1px solid rgba(255,61,90,0.2)' }} onClick={onLogout}>
            <LogOut size={14} /> Encerrar Sessão
          </button>
        </div>
      </div>
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acct, isDemo, balanceUsd, tradeHistory, openContracts, userProfile, profileSaving, editName, editCountry, editPhone, showToast, onLogout]);



  /* ─── RENDER ─────────────────────────────────────────────────────────────── */
  return (
    <div id="s-dash" className="screen active">

      {/* TOP NAV */}
      <nav className="dash-nav">
        <div className="dash-logo" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <LayoutDashboard size={20} color="var(--accent)" />
          <span>Dynamic<b>Works</b></span>
        </div>
        <div className="dash-nav-right">
          <div className="acct-pill" style={{ background: 'rgba(0,212,255,0.05)', borderColor: 'rgba(0,212,255,0.2)' }}>
            <div className="acct-dot" />
            <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{balanceUsd} USD</span>
          </div>
          {!isMobile && (
            <>
              <button className="btn btn-sm" style={{ background: 'var(--green)', color: '#000', fontWeight: 800, marginLeft: '10px' }} onClick={() => setShowDepositModal(true)}>Depósito</button>
              <div className="acct-pill" style={{ marginLeft: '8px' }}>
                <span style={{ fontSize: '0.6rem', opacity: 0.6 }}>{acct}</span>
              </div>
            </>
          )}
          {/* Bell */}
          <button onClick={() => setShowNotifPanel(v => !v)} style={{
            marginLeft: '8px', background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px',
            padding: '6px', cursor: 'pointer', position: 'relative',
            display: 'flex', alignItems: 'center',
          }}>
            <Bell size={16} color={unreadCount > 0 ? 'var(--accent)' : 'var(--text3)'} />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute', top: '-4px', right: '-4px',
                background: 'var(--red)', color: '#fff', fontSize: '0.5rem',
                fontWeight: 900, width: '14px', height: '14px',
                borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{unreadCount}</span>
            )}
          </button>
        </div>
      </nav>

      {showNotifPanel && <NotificationPanel />}
      {showDepositModal && <DepositModal />}

      {/* ═══ DESKTOP (≥ 901px) ═══ */}
      {!isMobile && (
        <div className="dw-desktop-body">
          <div className="dash-sidebar">
            <div className={`side-btn ${mobileNav === 'trade' ? 'active' : ''}`} onClick={() => setMobileNav('trade')}>
              <LineChart size={20} /><span>Trade</span>
            </div>
            <div className={`side-btn ${mobileNav === 'assets' ? 'active' : ''}`} onClick={() => setMobileNav('assets')}>
              <Store size={20} /><span>Ativos</span>
            </div>
            <div className="side-btn" onClick={() => setTradeTab('history')}>
              <History size={20} /><span>Histórico</span>
            </div>
            <div className={`side-btn ${mobileNav === 'ranking' ? 'active' : ''}`} onClick={() => setMobileNav('ranking')}>
              <TrendingUp size={20} /><span>Ranking</span>
            </div>
            <div style={{ marginTop: 'auto' }} className={`side-btn ${mobileNav === 'profile' ? 'active' : ''}`}
              onClick={() => setMobileNav('profile')}>
              <User size={20} /><span>Perfil</span>
            </div>
          </div>

          <div className="dash-main">
            <div className="asset-tabs">
              {(tradeMode === 'ACCU' ? ACCU_ASSETS : RISE_FALL_ASSETS).slice(0, 7).map(a => (
                <div key={a.sym} className={`asset-tab ${activeAsset.sym === a.sym ? 'active' : ''}`} onClick={() => setAsset(a.sym)}>
                  <Activity size={12} />{a.short}
                </div>
              ))}
              <div className="asset-tab" onClick={() => setMobileNav('assets')}><ChevronDown size={14} /> Mais</div>
            </div>
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}>
              <ChartTopBar />
              <ChartWidget />
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', opacity: 0.015, fontSize: '5rem', fontWeight: 900, pointerEvents: 'none', whiteSpace: 'nowrap', letterSpacing: '20px' }}>
                DYNAMICWORKS
              </div>
              <ModeSwitcher />
              <AiBadge />
            </div>
          </div>

          <div className="dash-trade-panel">
            {tradePanelJsx}
          </div>

          {/* Overlays always mounted — display controlled via CSS to preserve scroll position */}
          <div style={{ position: 'fixed', inset: '56px 0 0 64px', background: '#06090f', zIndex: 300, display: mobileNav === 'assets' ? 'flex' : 'none', flexDirection: 'column' }}>
            {assetsViewJsx}
          </div>
          <div style={{ position: 'fixed', inset: '56px 0 0 64px', background: '#06090f', zIndex: 300, display: mobileNav === 'ranking' ? 'flex' : 'none', flexDirection: 'column' }}>
            <RankingView currentAcct={acct} />
          </div>
          <div style={{ position: 'fixed', inset: '56px 0 0 64px', background: '#06090f', zIndex: 300, display: mobileNav === 'profile' ? 'flex' : 'none', flexDirection: 'column' }}>
            {profileViewJsx}
          </div>
        </div>
      )}

      {/* ═══ MOBILE (≤ 900px) ═══ */}
      {isMobile && (
        <div className="dw-mobile-body">
          {/* Mobile overlays — always mounted, CSS display preserved */}
          <div style={{ display: mobileNav === 'assets' ? 'flex' : 'none', flexDirection: 'column', flex: 1 }}>{assetsViewJsx}</div>
          <div style={{ display: mobileNav === 'ranking' ? 'flex' : 'none', flexDirection: 'column', flex: 1 }}><RankingView currentAcct={acct} /></div>
          <div style={{ display: mobileNav === 'profile' ? 'flex' : 'none', flexDirection: 'column', flex: 1 }}>{profileViewJsx}</div>

          {mobileNav === 'trade' && (
            <>
              <div className="dw-mobile-chart">
                <ChartTopBar />
                <ChartWidget />
                <ModeSwitcher />
                <AiBadge />
              </div>
              <div className="dw-mobile-trade">
                {tradePanelJsx}
              </div>
            </>
          )}
        </div>
      )}

      {/* BOTTOM NAV */}
      {isMobile && (
        <div className="bottom-nav show">
          <button className={`bnav-btn ${mobileNav === 'trade' ? 'active' : ''}`} onClick={() => setMobileNav('trade')}>
            <LineChart size={20} /><span>Trade</span>
          </button>
          <button className={`bnav-btn ${mobileNav === 'assets' ? 'active' : ''}`} onClick={() => setMobileNav('assets')}>
            <Store size={20} /><span>Ativos</span>
          </button>
          <button className="bnav-btn trade-fab" onClick={() => setMobileNav('trade')}>
            <Zap size={20} /><span>LIVE</span>
          </button>
          <button className={`bnav-btn ${mobileNav === 'ranking' ? 'active' : ''}`} onClick={() => setMobileNav('ranking')}>
            <TrendingUp size={20} /><span>Ranking</span>
          </button>
          <button className={`bnav-btn ${mobileNav === 'profile' ? 'active' : ''}`} onClick={() => setMobileNav('profile')}>
            <User size={20} /><span>Perfil</span>
          </button>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div className={`toast show ${toast.type === 'error' ? 'toast-confirm' : ''}`}>
          <div className="toast-t">{toast.type === 'success' ? 'Sucesso' : 'Erro'}</div>
          <div className="toast-b">{toast.msg}</div>
        </div>
      )}
    </div>
  );
}
