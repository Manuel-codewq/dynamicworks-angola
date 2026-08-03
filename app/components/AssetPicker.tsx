"use client";
import { useState } from "react";
import { Star } from "lucide-react";
import CoinIcon from "./CoinIcon";
import type { AssetCategory } from "@/lib/assets";

export interface PickerPair {
  symbol: string;
  label: string;
  category: string;
  decimals: number;
}

const CATEGORY_TABS: { key: AssetCategory; label: string }[] = [
  { key: "Forex", label: "Moedas" },
  { key: "Cripto", label: "Cripto" },
  { key: "Matérias-primas", label: "Matérias-primas" },
  { key: "Acções", label: "Acções" },
];

export default function AssetPicker({
  pairs,
  selectedSymbol,
  tickerPrices,
  sessionOpenPrices,
  payoutMap,
  favorites,
  onToggleFavorite,
  onSelect,
  compact = false,
  suspendedPairs,
}: {
  pairs: PickerPair[];
  selectedSymbol?: string;
  tickerPrices: Record<string, number>;
  sessionOpenPrices: Record<string, number>;
  payoutMap: Record<string, number>;
  favorites: Set<string>;
  onToggleFavorite: (symbol: string) => void;
  onSelect: (pair: PickerPair) => void;
  compact?: boolean;
  /** Labels suspensos pela protecção da casa — mostrados mas não seleccionáveis. */
  suspendedPairs?: Set<string>;
}) {
  const [activeTab, setActiveTab] = useState<"favorites" | AssetCategory>("Forex");

  const filtered = activeTab === "favorites"
    ? pairs.filter(p => favorites.has(p.symbol))
    : pairs.filter(p => p.category === activeTab);

  const iconSize = compact ? 24 : 38;
  const upColor = "#00c076", dnColor = "#ff3b5c";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Abas */}
      <div style={{
        display: "flex", gap: 6, padding: compact ? "8px 10px" : "10px 12px",
        overflowX: "auto", borderBottom: "1px solid #1a2540", flexShrink: 0, scrollbarWidth: "none",
      }}>
        <button onClick={() => setActiveTab("favorites")} style={tabStyle(activeTab === "favorites")}>
          <Star size={12} fill={activeTab === "favorites" ? "#f5a623" : "none"} color={activeTab === "favorites" ? "#f5a623" : "#64748b"} />
          {favorites.size}
        </button>
        {CATEGORY_TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={tabStyle(activeTab === t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Lista */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: "32px 16px", textAlign: "center", color: "#334155", fontSize: 13 }}>
            {activeTab === "favorites" ? "Sem favoritos ainda — toca na estrela de um par para o adicionar." : "Sem pares nesta categoria."}
          </div>
        ) : filtered.map(p => {
          const price    = tickerPrices[p.symbol] ?? 0;
          const open     = sessionOpenPrices[p.symbol] ?? 0;
          const isUp     = price >= open;
          const pct      = open > 0 && price > 0 ? ((price - open) / open * 100) : 0;
          const isActive = selectedSymbol === p.symbol;
          const isFav    = favorites.has(p.symbol);
          const payout   = Math.round((payoutMap[p.label] ?? 0.74) * 100);
          // Par suspenso pela protecção da casa: continua na lista (não
          // desaparece debaixo de quem está a olhar para o gráfico) mas não é
          // seleccionável. O bloqueio real é no servidor.
          const isSuspended = suspendedPairs?.has(p.label) ?? false;

          return (
            <button key={p.symbol} onClick={() => { if (!isSuspended) onSelect(p); }}
              disabled={isSuspended}
              style={{
                width: "100%", background: isActive ? "rgba(255,255,255,0.07)" : "transparent",
                border: "none", borderBottom: "1px solid #141824",
                cursor: isSuspended ? "not-allowed" : "pointer", position: "relative",
                opacity: isSuspended ? 0.45 : 1,
                padding: compact ? "8px 14px" : "13px 14px", display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
              <div style={{ display: "flex", alignItems: "center", gap: compact ? 8 : 12, minWidth: 0 }}>
                {isActive && <div style={{ width: 3, height: 32, background: "#ffffff", borderRadius: 2, position: "absolute", left: 0 }} />}
                <CoinIcon label={p.label} size={iconSize} />
                <div style={{ textAlign: "left", minWidth: 0 }}>
                  <div style={{ color: "#ffffff", fontWeight: 700, fontSize: compact ? 13 : 14 }}>{p.label}</div>
                  {!compact && (
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3 }}>
                      <span style={{ color: "#334155", fontSize: 11 }}>{p.category}</span>
                      {isSuspended ? (
                        <span style={{ color: "#ef4444", fontSize: 9, fontWeight: 800, background: "rgba(239,68,68,0.12)", borderRadius: 5, padding: "1px 5px" }}>
                          INDISPONÍVEL
                        </span>
                      ) : (
                        <span style={{ color: "#ffffff", fontSize: 9, fontWeight: 800, background: "rgba(255,255,255,0.12)", borderRadius: 5, padding: "1px 5px" }}>
                          {payout}%
                        </span>
                      )}
                    </div>
                  )}
                  {compact && (
                    <span style={{ color: "#ffffff", fontSize: 10, fontWeight: 800, background: "rgba(255,255,255,0.12)", borderRadius: 5, padding: "1px 5px" }}>
                      {payout}%
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                {price > 0 && (
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: isUp ? upColor : dnColor, fontWeight: 700, fontSize: compact ? 11 : 14, fontVariantNumeric: "tabular-nums" }}>
                      {price.toFixed(p.decimals)}
                    </div>
                    {!compact && (
                      <div style={{ color: isUp ? upColor : dnColor, fontSize: 11, fontWeight: 700, marginTop: 2 }}>
                        {isUp ? "▲" : "▼"} {Math.abs(pct).toFixed(2)}%
                      </div>
                    )}
                  </div>
                )}
                <span
                  role="button"
                  onClick={(e) => { e.stopPropagation(); onToggleFavorite(p.symbol); }}
                  style={{ display: "flex", padding: 4, cursor: "pointer" }}
                >
                  <Star size={16} fill={isFav ? "#f5a623" : "none"} color={isFav ? "#f5a623" : "#475569"} />
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function tabStyle(active: boolean): React.CSSProperties {
  return {
    display: "flex", alignItems: "center", gap: 4, flexShrink: 0,
    background: active ? "rgba(255,255,255,0.12)" : "transparent",
    color: active ? "#ffffff" : "#64748b",
    border: `1px solid ${active ? "rgba(255,255,255,0.3)" : "#1e2d50"}`,
    borderRadius: 20, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer",
    whiteSpace: "nowrap",
  };
}
