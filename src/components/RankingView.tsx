'use client';

import { useEffect, useState } from 'react';
import { subscribeRanking, RankingEntry } from '@/lib/firebase-db';
import { Trophy, TrendingUp, Users, Medal } from 'lucide-react';

interface RankingViewProps {
  currentAcct: string | null;
}

export default function RankingView({ currentAcct }: RankingViewProps) {
  const [entries, setEntries]   = useState<RankingEntry[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const unsub = subscribeRanking((data) => {
      setEntries(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const myRank = entries.findIndex(e => e.acct === currentAcct) + 1;

  const medalColor = (i: number) => {
    if (i === 0) return '#FFD700'; // ouro
    if (i === 1) return '#C0C0C0'; // prata
    if (i === 2) return '#CD7F32'; // bronze
    return 'var(--text3)';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#06090f' }}>

      {/* Header */}
      <div style={{
        padding: '20px 16px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        background: 'linear-gradient(180deg, rgba(0,212,255,0.05) 0%, transparent 100%)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <Trophy size={20} color="#FFD700" />
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 900 }}>Ranking Global</h2>
        </div>
        <div style={{ fontSize: '0.62rem', color: 'var(--text3)' }}>
          Top traders com contas reais · Atualiza em tempo real
        </div>
        {myRank > 0 && (
          <div style={{
            marginTop: '10px', padding: '8px 12px',
            background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)',
            borderRadius: '10px', fontSize: '0.7rem', color: 'var(--accent)',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            <Medal size={13} /> A tua posição: <strong>#{myRank}</strong>
          </div>
        )}
      </div>

      {/* Stat Pills */}
      <div style={{ display: 'flex', gap: '8px', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ flex: 1, textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '8px 4px' }}>
          <div style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--accent)' }}>{entries.length}</div>
          <div style={{ fontSize: '0.55rem', color: 'var(--text3)' }}>Traders</div>
        </div>
        <div style={{ flex: 1, textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '8px 4px' }}>
          <div style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--green)' }}>
            {entries.length ? `${Math.round(entries.reduce((s,e) => s + e.winRate, 0) / entries.length)}%` : '—'}
          </div>
          <div style={{ fontSize: '0.55rem', color: 'var(--text3)' }}>Win Rate Médio</div>
        </div>
        <div style={{ flex: 1, textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '8px 4px' }}>
          <div style={{ fontSize: '1rem', fontWeight: 900 }}>
            {entries.length ? `$${Math.round(entries.reduce((s,e) => s + e.totalPnl, 0)).toLocaleString()}` : '—'}
          </div>
          <div style={{ fontSize: '0.55rem', color: 'var(--text3)' }}>PnL Total</div>
        </div>
      </div>

      {/* Lista */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 16px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)', fontSize: '0.75rem' }}>
            <div style={{ width: '24px', height: '24px', border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 0.8s linear infinite' }} />
            A carregar ranking...
          </div>
        ) : entries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text3)' }}>
            <Users size={32} style={{ opacity: 0.3, display: 'block', margin: '0 auto 12px' }} />
            <div style={{ fontSize: '0.78rem', fontWeight: 700 }}>Ainda não há traders</div>
            <div style={{ fontSize: '0.62rem', marginTop: '6px', opacity: 0.6 }}>
              Faz o teu primeiro trade real para entrar no ranking!
            </div>
          </div>
        ) : (
          entries.map((entry, i) => {
            const isMe = entry.acct === currentAcct;
            const pnlPos = entry.totalPnl >= 0;
            return (
              <div key={entry.acct} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '10px 12px', marginBottom: '6px',
                background: isMe ? 'rgba(0,212,255,0.08)' : 'rgba(255,255,255,0.02)',
                border: isMe ? '1px solid rgba(0,212,255,0.25)' : '1px solid rgba(255,255,255,0.04)',
                borderRadius: '12px',
                transition: 'all 0.2s',
              }}>
                {/* Posição */}
                <div style={{
                  width: '28px', textAlign: 'center', flexShrink: 0,
                  fontFamily: 'var(--mono)', fontWeight: 900,
                  color: medalColor(i),
                  fontSize: i < 3 ? '1rem' : '0.72rem',
                }}>
                  {i < 3 ? ['🥇','🥈','🥉'][i] : `#${i + 1}`}
                </div>

                {/* Avatar */}
                <div style={{
                  width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
                  background: isMe ? 'rgba(0,212,255,0.2)' : 'rgba(255,255,255,0.07)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.7rem', fontWeight: 900, color: isMe ? 'var(--accent)' : 'var(--text3)',
                }}>
                  {entry.displayName.slice(0, 2).toUpperCase()}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.displayName}{isMe ? ' (Tu)' : ''}
                  </div>
                  <div style={{ fontSize: '0.58rem', color: 'var(--text3)', marginTop: '2px', display: 'flex', gap: '8px' }}>
                    <span>{entry.countryFlag} {entry.country}</span>
                    <span><TrendingUp size={9} style={{ display: 'inline', verticalAlign: 'middle' }} /> {entry.winRate}%</span>
                    <span>{entry.totalTrades} trades</span>
                  </div>
                </div>

                {/* PnL */}
                <div style={{
                  fontFamily: 'var(--mono)', fontWeight: 900, fontSize: '0.85rem', flexShrink: 0,
                  color: pnlPos ? 'var(--green)' : 'var(--red)',
                }}>
                  {pnlPos ? '+' : ''}${entry.totalPnl.toFixed(2)}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
