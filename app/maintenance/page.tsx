"use client";
import { useEffect, useState } from "react";
import { Settings, TrendingUp } from "lucide-react";

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
      alignItems: "center", justifyContent: "center", padding: 24,
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      <div style={{ textAlign: "center", maxWidth: 480 }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 36 }}>
          <img src="/logo-icon.jpeg" alt="Dynamic Works" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 9 }} />
          <span style={{ color: "#fff", fontWeight: 800, fontSize: 20 }}>Dynamic Works</span>
        </div>

        {/* Ícone animado */}
        <div style={{ marginBottom: 24, display: "flex", justifyContent: "center" }}>
          <div style={{
            width: 72, height: 72, borderRadius: "50%",
            background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
            animation: "spin 3s linear infinite",
          }}>
            <Settings size={34} color="#f5a623" />
          </div>
        </div>

        <h1 style={{ color: "#fff", fontSize: 26, fontWeight: 800, margin: "0 0 12px" }}>
          Plataforma em Manutenção
        </h1>
        <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.7, margin: "0 0 32px" }}>
          Estamos a realizar melhorias para oferecer uma experiência ainda melhor.
          A plataforma volta em breve.
        </p>

        {/* Countdown */}
        <div style={{
          background: "#111827", border: "1px solid #1e2d50", borderRadius: 14,
          padding: "20px 32px", display: "inline-block",
        }}>
          <p style={{ color: "#64748b", fontSize: 11, margin: "0 0 6px", textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>
            Próxima verificação em
          </p>
          <div style={{ color: "#f5a623", fontSize: 40, fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>
            {String(seconds).padStart(2, "0")}s
          </div>
        </div>

        <p style={{ color: "#374151", fontSize: 12, marginTop: 28 }}>
          Dynamics Works © {new Date().getFullYear()} · Angola
        </p>
      </div>
    </div>
  );
}
