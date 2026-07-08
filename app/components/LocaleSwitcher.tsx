"use client";
import { useState, useRef, useEffect } from "react";
import { useI18n, LOCALES, type Locale } from "@/lib/i18n";

export default function LocaleSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useI18n();
  const [open, setOpen]       = useState(false);
  const ref                   = useRef<HTMLDivElement>(null);

  const current = LOCALES.find(l => l.code === locale) ?? LOCALES[0];

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative", userSelect: "none" }}>
      <button
        onClick={() => setOpen(o => !o)}
        title="Mudar idioma / Change language"
        style={{
          display: "flex", alignItems: "center", gap: compact ? 4 : 6,
          background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 8, padding: compact ? "4px 8px" : "6px 10px",
          color: "#e2e8f0", fontSize: compact ? 12 : 13,
          cursor: "pointer", transition: "background 0.15s", whiteSpace: "nowrap",
        }}
      >
        <span style={{ fontSize: compact ? 14 : 16 }}>{current.flag}</span>
        {!compact && <span style={{ fontWeight: 600 }}>{current.code.toUpperCase()}</span>}
        <span style={{ color: "#64748b", fontSize: 10 }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0,
          background: "#1e293b", border: "1px solid #334155",
          borderRadius: 10, overflow: "hidden", zIndex: 9999,
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          minWidth: 150,
        }}>
          {LOCALES.map(l => (
            <button
              key={l.code}
              onClick={() => { setLocale(l.code as Locale); setOpen(false); }}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                width: "100%", padding: "10px 14px",
                background: l.code === locale ? "rgba(255,255,255,0.12)" : "transparent",
                border: "none", cursor: "pointer", textAlign: "left",
                color: l.code === locale ? "#ffffff" : "#cbd5e1",
                fontSize: 13, fontWeight: l.code === locale ? 700 : 400,
                transition: "background 0.1s",
              }}
            >
              <span style={{ fontSize: 18 }}>{l.flag}</span>
              <span>{l.label}</span>
              {l.code === locale && <span style={{ marginLeft: "auto", fontSize: 12 }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
