"use client";
import { useEffect, useState } from "react";

export default function MaintenancePage() {
  const [seconds, setSeconds] = useState(30);

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) { window.location.reload(); return 30; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      minHeight: "100vh", background: "#0a0f1e", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "sans-serif",
    }}>
      <div style={{ textAlign: "center", maxWidth: 480 }}>
        <div style={{ fontSize: 72, marginBottom: 16, animation: "spin 3s linear infinite" }}>⚙️</div>
        <h1 style={{ color: "#fff", fontSize: 28, fontWeight: 800, margin: "0 0 12px" }}>
          Plataforma em Manutenção
        </h1>
        <p style={{ color: "#94a3b8", fontSize: 15, lineHeight: 1.6, margin: "0 0 32px" }}>
          Estamos a realizar melhorias para lhe oferecer uma experiência ainda melhor.
          Por favor, aguarde alguns instantes.
        </p>
        <div style={{
          background: "#111827", border: "1px solid #1e2d50", borderRadius: 12,
          padding: "20px 32px", display: "inline-block",
        }}>
          <p style={{ color: "#94a3b8", fontSize: 12, margin: "0 0 6px", textTransform: "uppercase", letterSpacing: 1 }}>
            Próxima verificação em
          </p>
          <div style={{ color: "#f5a623", fontSize: 40, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
            {String(seconds).padStart(2, "0")}s
          </div>
        </div>
        <p style={{ color: "#475569", fontSize: 12, marginTop: 24 }}>
          Dynamics Works © {new Date().getFullYear()}
        </p>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
