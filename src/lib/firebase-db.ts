/**
 * firebase-db.ts — DynamicWorks
 * Funções para interagir com o Firestore:
 * - Guardar resultados de trades
 * - Ler e atualizar perfis de utilizadores
 * - Obter ranking global
 */

import { db } from './firebase';
import {
  doc, setDoc, getDoc, updateDoc, increment,
  collection, query, orderBy, limit, onSnapshot,
  serverTimestamp, Timestamp,
} from 'firebase/firestore';

// ── Tipos ────────────────────────────────────────────────────────────────────
export interface UserProfile {
  acct: string;
  displayName: string;
  country: string;
  countryFlag: string;
  phone: string;
  verified: boolean;   // true quando preenche nome+país+telefone
  isDemo: boolean;
  totalPnl: number;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface RankingEntry {
  acct: string;
  displayName: string;
  country: string;
  countryFlag: string;
  totalPnl: number;
  totalTrades: number;
  winRate: number;
  wins: number;
}

export interface TradeResult {
  id: string;
  symbol: string;
  type: string;
  stake: number;
  pnl: number;
  result: 'win' | 'loss';
  closedAt: number;
}

// ── Países disponíveis ───────────────────────────────────────────────────────
export const COUNTRIES = [
  { code: 'AO', name: 'Angola',           flag: '🇦🇴' },
  { code: 'PT', name: 'Portugal',         flag: '🇵🇹' },
  { code: 'BR', name: 'Brasil',           flag: '🇧🇷' },
  { code: 'MZ', name: 'Moçambique',       flag: '🇲🇿' },
  { code: 'CV', name: 'Cabo Verde',       flag: '🇨🇻' },
  { code: 'GW', name: 'Guiné-Bissau',     flag: '🇬🇼' },
  { code: 'ST', name: 'São Tomé',         flag: '🇸🇹' },
  { code: 'GQ', name: 'Guiné Equatorial', flag: '🇬🇶' },
  { code: 'TL', name: 'Timor-Leste',      flag: '🇹🇱' },
  { code: 'ZA', name: 'África do Sul',    flag: '🇿🇦' },
  { code: 'NG', name: 'Nigéria',          flag: '🇳🇬' },
  { code: 'KE', name: 'Quénia',           flag: '🇰🇪' },
  { code: 'GH', name: 'Gana',             flag: '🇬🇭' },
  { code: 'CM', name: 'Camarões',         flag: '🇨🇲' },
  { code: 'OTHER', name: 'Outro',         flag: '🌍' },
];

// ── Guardar resultado de trade ───────────────────────────────────────────────
export async function saveTradeResult(acct: string, trade: TradeResult, isDemo: boolean): Promise<void> {
  if (!acct || isDemo) return; // Não guardar trades demo no ranking

  try {
    const userRef = doc(db, 'users', acct);
    await updateDoc(userRef, {
      totalTrades: increment(1),
      wins:        trade.result === 'win' ? increment(1) : increment(0),
      losses:      trade.result === 'loss' ? increment(1) : increment(0),
      totalPnl:    increment(trade.pnl),
      updatedAt:   serverTimestamp(),
    });

    // Recalcular winRate após update
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const d = snap.data() as UserProfile;
      const wr = d.totalTrades > 0 ? Math.round((d.wins / d.totalTrades) * 100) : 0;
      await updateDoc(userRef, { winRate: wr });
    }
  } catch (err) {
    // Se o doc não existe ainda, criar
    try {
      const userRef = doc(db, 'users', acct);
      await setDoc(userRef, {
        acct,
        displayName: acct,
        country: '',
        countryFlag: '🌍',
        phone: '',
        verified: false,
        isDemo,
        totalPnl:    trade.pnl,
        totalTrades: 1,
        wins:        trade.result === 'win' ? 1 : 0,
        losses:      trade.result === 'loss' ? 1 : 0,
        winRate:     trade.result === 'win' ? 100 : 0,
        createdAt:   serverTimestamp(),
        updatedAt:   serverTimestamp(),
      });
    } catch (e) {
      console.error('[Firebase] Erro ao guardar trade:', e);
    }
  }
}

// ── Ler perfil do utilizador ─────────────────────────────────────────────────
export async function getUserProfile(acct: string): Promise<UserProfile | null> {
  if (!acct) return null;
  try {
    const snap = await getDoc(doc(db, 'users', acct));
    return snap.exists() ? (snap.data() as UserProfile) : null;
  } catch (err) {
    console.error('[Firebase] Erro ao ler perfil:', err);
    return null;
  }
}

// ── Criar/atualizar perfil ───────────────────────────────────────────────────
export async function updateUserProfile(acct: string, data: Partial<UserProfile>): Promise<void> {
  if (!acct) return;
  try {
    const userRef = doc(db, 'users', acct);
    const snap = await getDoc(userRef);
    const isVerified = !!(data.displayName && data.country && data.phone);
    if (snap.exists()) {
      await updateDoc(userRef, { ...data, verified: isVerified, updatedAt: serverTimestamp() });
    } else {
      const defaults = {
        acct,
        displayName: '',
        country: '',
        countryFlag: '🌍',
        phone: '',
        isDemo: false,
        totalPnl: 0,
        totalTrades: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(userRef, { ...defaults, ...data, verified: isVerified });
    }
  } catch (err) {
    console.error('[Firebase] Erro ao atualizar perfil:', err);
    throw err;
  }
}

// ── Subscrever ranking em tempo real ─────────────────────────────────────────
export function subscribeRanking(
  onUpdate: (entries: RankingEntry[]) => void,
): () => void {
  const q = query(
    collection(db, 'users'),
    orderBy('totalPnl', 'desc'),
    limit(20),
  );

  const unsub = onSnapshot(q, (snap) => {
    const entries: RankingEntry[] = snap.docs
      .filter(d => !d.data().isDemo && d.data().totalTrades > 0)
      .map(d => {
        const data = d.data();
        return {
          acct:         data.acct,
          displayName:  data.displayName || data.acct,
          country:      data.country || '',
          countryFlag:  data.countryFlag || '🌍',
          totalPnl:     data.totalPnl ?? 0,
          totalTrades:  data.totalTrades ?? 0,
          winRate:      data.winRate ?? 0,
          wins:         data.wins ?? 0,
        };
      });
    onUpdate(entries);
  }, (err) => {
    console.error('[Firebase] Erro ao ler ranking:', err);
  });

  return unsub;
}
