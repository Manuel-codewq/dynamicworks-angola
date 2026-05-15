"use client";
import { useState, useEffect, useCallback } from "react";

export type MarketMode = "forex" | "otc";

interface MarketModeState {
  mode:        MarketMode;
  autoMode:    MarketMode;
  override:    MarketMode | null;
  isOverridden: boolean;
  nextSwitchAt: string;
  loading:     boolean;
}

function calcAutoMode(): MarketMode {
  const now    = new Date();
  const utcDay = now.getUTCDay();
  const utcH   = now.getUTCHours();
  return utcDay >= 1 && utcDay <= 5 && utcH >= 6 && utcH < 19 ? "forex" : "otc";
}

function calcCountdown(autoMode: MarketMode): string {
  const now  = new Date();
  const next = new Date();
  if (autoMode === "forex") {
    // Próxima troca: hoje às 20h WAT = 19h UTC
    next.setUTCHours(19, 0, 0, 0);
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  } else {
    // Próxima troca: amanhã às 07h WAT = 06h UTC (ou hoje se ainda não passou)
    next.setUTCHours(6, 0, 0, 0);
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  }
  const diff = next.getTime() - now.getTime();
  const hh   = Math.floor(diff / 3_600_000);
  const mm   = Math.floor((diff % 3_600_000) / 60_000);
  const ss   = Math.floor((diff % 60_000) / 1_000);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export function useMarketMode() {
  const [state, setState] = useState<MarketModeState>({
    mode: calcAutoMode(), autoMode: calcAutoMode(),
    override: null, isOverridden: false,
    nextSwitchAt: calcCountdown(calcAutoMode()), loading: true,
  });

  const fetchMode = useCallback(async () => {
    try {
      const res = await fetch("/api/market-mode");
      if (!res.ok) return;
      const d = await res.json();
      setState(prev => ({
        ...prev,
        mode:         d.mode,
        autoMode:     d.autoMode,
        override:     d.override,
        isOverridden: d.isOverridden,
        loading:      false,
      }));
    } catch { setState(prev => ({ ...prev, loading: false })); }
  }, []);

  // Polling ao servidor a cada 5s
  useEffect(() => {
    fetchMode();
    const id = setInterval(fetchMode, 5_000);
    return () => clearInterval(id);
  }, [fetchMode]);

  // Countdown local actualizado a cada segundo
  useEffect(() => {
    const id = setInterval(() => {
      setState(prev => ({ ...prev, nextSwitchAt: calcCountdown(prev.autoMode) }));
    }, 1_000);
    return () => clearInterval(id);
  }, []);

  const setMode = useCallback(async (mode: MarketMode | null) => {
    await fetch("/api/market-mode", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ mode }),
    });
    fetchMode();
  }, [fetchMode]);

  return { ...state, setMode, refresh: fetchMode };
}
