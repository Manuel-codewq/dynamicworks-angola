"use client";
import { useState, useEffect } from "react";
import { Download, X, TrendingUp } from "lucide-react";

const DISMISSED_KEY = "dw_pwa_dismissed";

export default function PwaInstallPrompt() {
  const [prompt,    setPrompt]    = useState<any>(null);
  const [visible,   setVisible]   = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Não mostrar se já instalado (standalone) ou se o utilizador já dispensou
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    if (localStorage.getItem(DISMISSED_KEY)) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e);
      // Mostrar o banner 3s após capturar o evento
      setTimeout(() => setVisible(true), 3000);
    };

    window.addEventListener("beforeinstallprompt", handler as any);

    // Detectar instalação concluída
    window.addEventListener("appinstalled", () => {
      setVisible(false);
      setInstalled(true);
    });

    return () => window.removeEventListener("beforeinstallprompt", handler as any);
  }, []);

  async function handleInstall() {
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") {
      setVisible(false);
      setInstalled(true);
    }
    setPrompt(null);
  }

  function handleDismiss() {
    setVisible(false);
    localStorage.setItem(DISMISSED_KEY, "1");
  }

  if (!visible) return null;

  return (
    <div style={{
      position: "fixed", bottom: 72, left: 12, right: 12, zIndex: 1100,
      background: "#111827",
      border: "1px solid rgba(245,166,35,0.4)",
      borderRadius: 16,
      padding: "16px",
      boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
      display: "flex", alignItems: "center", gap: 12,
      animation: "slideUpPwa 0.35s cubic-bezier(0.32,0.72,0,1)",
    }}>
      <style>{`
        @keyframes slideUpPwa {
          from { transform: translateY(24px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>

      {/* Ícone da app */}
      <div style={{
        width: 46, height: 46, borderRadius: 12, flexShrink: 0,
        background: "linear-gradient(135deg,#f5a623,#e8940f)",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 4px 12px rgba(245,166,35,0.4)",
      }}>
        <TrendingUp size={24} color="#0a0f1e" strokeWidth={2.5} />
      </div>

      {/* Texto */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>
          Instalar Dynamics Works
        </div>
        <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>
          Adicionar ao ecrã inicial para acesso rápido
        </div>
      </div>

      {/* Botões */}
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <button
          onClick={handleInstall}
          style={{
            background: "#f5a623", color: "#0a0f1e",
            border: "none", borderRadius: 10,
            padding: "9px 14px", fontSize: 13, fontWeight: 700,
            cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
          }}>
          <Download size={14} /> Instalar
        </button>
        <button
          onClick={handleDismiss}
          style={{
            background: "rgba(255,255,255,0.05)", border: "none",
            borderRadius: 10, width: 36, height: 36,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
          <X size={16} color="#64748b" />
        </button>
      </div>
    </div>
  );
}
