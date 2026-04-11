import { create } from 'zustand';
import { ASSETS_AVAILABLE, ACCU_ASSETS, RISE_FALL_ASSETS, AssetConfig } from '@/lib/constants';

interface TradeHistoryItem {
  id: string;
  symbol: string;
  type: 'ACCU' | 'CALL' | 'PUT';
  stake: number;
  pnl: number;
  result: 'win' | 'loss';
  closedAt: number; // epoch
}

interface TradeState {
  // Session
  acct: string | null;
  balanceUsd: string;
  balanceAoa: string;
  isDemo: boolean;
  
  // App Mode & Chart
  tradeMode: 'ACCU' | 'RISE_FALL';
  chartType: 'AREA' | 'CANDLE';
  activeAsset: AssetConfig;
  
  // Real-time
  currentSpot: number | null;
  currentDirection: 'up' | 'down' | null;
  percentageGrowthTarget: number;
  
  // Trading params
  stakeAmount: number;
  duration: number;
  durationUnit: 't' | 's' | 'm';
  takeProfitEnabled: boolean;
  takeProfitAmount: number;
  
  // Contracts & History
  openContracts: any[];
  tradeHistory: TradeHistoryItem[];

  // AI Trader
  aiActive: boolean;
  aiSignal: 'up' | 'down' | 'neutral';
  aiConfidence: number; // 0-100

  // Notifications
  notifications: { id: string; msg: string; type: 'win' | 'loss' | 'info'; ts: number }[];
  
  // Actions
  setAcct: (acct: string | null) => void;
  setBalance: (usd: string, aoa: string) => void;
  setIsDemo: (isDemo: boolean) => void;
  setMode: (mode: 'ACCU' | 'RISE_FALL') => void;
  setChartType: (type: 'AREA' | 'CANDLE') => void;
  setAsset: (symbol: string) => void;
  setSpot: (spot: number) => void;
  setGrowthTarget: (pct: number) => void;
  setStakeAmount: (amount: number) => void;
  setDuration: (val: number, unit: 't' | 's' | 'm') => void;
  setOpenContracts: (contracts: any[]) => void;
  addTradeHistory: (item: TradeHistoryItem) => void;
  setAiActive: (active: boolean) => void;
  setAiSignal: (signal: 'up' | 'down' | 'neutral', confidence: number) => void;
  addNotification: (msg: string, type: 'win' | 'loss' | 'info') => void;
  clearNotification: (id: string) => void;
}

export const useStore = create<TradeState>((set) => ({
  acct: null,
  balanceUsd: '0.00',
  balanceAoa: '0.00',
  isDemo: true,
  
  tradeMode: 'ACCU',
  chartType: 'AREA',
  activeAsset: ACCU_ASSETS[0], // Volatility 10 — padrão para Accumulators
  
  currentSpot: null,
  currentDirection: null,
  percentageGrowthTarget: 3, 
  
  stakeAmount: 10,
  duration: 5,
  durationUnit: 't',
  takeProfitEnabled: false,
  takeProfitAmount: 0,
  
  openContracts: [],
  tradeHistory: [],
  aiActive: false,
  aiSignal: 'neutral',
  aiConfidence: 0,
  notifications: [],
  
  setAcct: (acct) => set({ acct }),
  setBalance: (usd, aoa) => set({ balanceUsd: usd, balanceAoa: aoa }),
  setIsDemo: (isDemo) => set({ isDemo }),
  setMode: (mode) => set((state) => ({
    tradeMode: mode,
    chartType: mode === 'ACCU' ? 'AREA' : 'CANDLE',
    // Ao mudar de modo, mudar para o primeiro ativo compatível
    activeAsset: (() => {
      const list = mode === 'ACCU' ? ACCU_ASSETS : RISE_FALL_ASSETS;
      const current = state.activeAsset;
      // Se o ativo atual já é compatível com o novo modo, manter
      const isCompat = list.some(a => a.sym === current.sym);
      return isCompat ? current : list[0];
    })(),
  })),
  setChartType: (type) => set({ chartType: type }),
  setAsset: (symbol) => set({ activeAsset: ASSETS_AVAILABLE.find(a => a.sym === symbol) || ASSETS_AVAILABLE[0] }),
  setSpot: (spot) => set((state) => ({ 
    currentSpot: spot,
    currentDirection: state.currentSpot ? (spot > state.currentSpot ? 'up' : spot < state.currentSpot ? 'down' : state.currentDirection) : null
  })),
  setGrowthTarget: (pct) => set({ percentageGrowthTarget: pct }),
  setStakeAmount: (amount) => set({ stakeAmount: amount }),
  setDuration: (val, unit) => set({ duration: val, durationUnit: unit }),
  setOpenContracts: (contracts) => set({ openContracts: contracts }),
  addTradeHistory: (item) => set(state => ({ tradeHistory: [item, ...state.tradeHistory].slice(0, 50) })),
  setAiActive: (active) => set({ aiActive: active }),
  setAiSignal: (signal, confidence) => set({ aiSignal: signal, aiConfidence: confidence }),
  addNotification: (msg, type) => set(state => ({
    notifications: [{ id: Date.now().toString(), msg, type, ts: Date.now() }, ...state.notifications].slice(0, 20)
  })),
  clearNotification: (id) => set(state => ({ notifications: state.notifications.filter(n => n.id !== id) })),
}));

