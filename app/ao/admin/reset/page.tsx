"use client";
import { useState } from "react";
import {
  AlertTriangle, Trash2, ShieldAlert, CheckCircle2,
  Users, TrendingUp, ArrowLeftRight, ScanFace, Trophy, RotateCcw,
} from "lucide-react";

const CONFIRM_PHRASE = "RESET_SERVIDOR";

const WHAT_GETS_DELETED = [
  { Icon: Users,          label: "Todos os utilizadores (exceto admins)" },
  { Icon: TrendingUp,     label: "Todas as operações e posições" },
  { Icon: ArrowLeftRight, label: "Todos os depósitos e levantamentos" },
  { Icon: ScanFace,       label: "Todos os documentos KYC submetidos" },
  { Icon: Trophy,         label: "Todos os torneios e participantes" },
  { Icon: RotateCcw,      label: "Sessões, logs, cache NIF e rate limits" },
];

const WHAT_STAYS = [
  "Contas de administrador",
  "Configurações da plataforma",
  "Histórico de preços (velas)",
  "Códigos promocionais",
];

export default function ResetPage() {
  const [input,   setInput]   = useState("");
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<{ ok: boolean; message: string } | null>(null);
  const [error,   setError]   = useState("");

  const confirmed = input === CONFIRM_PHRASE;

  async function handleReset() {
    if (!confirmed) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res  = await fetch("/api/admin/reset", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ confirm: CONFIRM_PHRASE }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao executar o reset");
      } else {
        setResult({ ok: true, message: data.message });
        setInput("");
      }
    } catch {
      setError("Erro de ligação. Tente novamente.");
    }
    setLoading(false);
  }

  const card: React.CSSProperties = {
    background: "#111827", border: "1px solid #1e2d50",
    borderRadius: 12, padding: 24, marginBottom: 16,
  };
  const h2: React.CSSProperties = { color: "#fff", fontSize: 16, fontWeight: 700, margin: "0 0 16px" };
  const label: React.CSSProperties = { color: "#94a3b8", fontSize: 13 };

  return (
    <div style={{ padding: 32, maxWidth: 640, fontFamily: "system-ui, -apple-system, sans-serif" }}>

      {/* Header de perigo */}
      <div style={{
        display: "flex", alignItems: "center", gap: 14,
        background: "rgba(239,68,68,0.08)", border: "2px solid rgba(239,68,68,0.4)",
        borderRadius: 12, padding: "18px 24px", marginBottom: 28,
      }}>
        <ShieldAlert size={32} color="#ef4444" style={{ flexShrink: 0 }} />
        <div>
          <div style={{ color: "#ef4444", fontSize: 18, fontWeight: 800, marginBottom: 4 }}>
            Reset Total do Servidor
          </div>
          <div style={{ color: "#fca5a5", fontSize: 13, lineHeight: 1.5 }}>
            Esta operação é <strong>irreversível</strong>. Todos os dados de utilizadores
            serão apagados permanentemente. Os admins são preservados.
          </div>
        </div>
      </div>

      {/* O que é apagado */}
      <div style={card}>
        <h2 style={{ ...h2, color: "#ef4444" }}>
          <Trash2 size={16} style={{ marginRight: 8, verticalAlign: "middle" }} />
          O que será apagado
        </h2>
        {WHAT_GETS_DELETED.map(({ Icon, label: l }) => (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <Icon size={15} color="#ef4444" style={{ flexShrink: 0 }} />
            <span style={{ color: "#fca5a5", fontSize: 14 }}>{l}</span>
          </div>
        ))}
      </div>

      {/* O que fica */}
      <div style={card}>
        <h2 style={{ ...h2, color: "#22c55e" }}>
          <CheckCircle2 size={16} style={{ marginRight: 8, verticalAlign: "middle" }} />
          O que é preservado
        </h2>
        {WHAT_STAYS.map(item => (
          <div key={item} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <CheckCircle2 size={14} color="#22c55e" style={{ flexShrink: 0 }} />
            <span style={{ color: "#86efac", fontSize: 14 }}>{item}</span>
          </div>
        ))}
      </div>

      {/* Resultado / Erro */}
      {result?.ok && (
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.3)",
          borderRadius: 10, padding: "14px 18px", marginBottom: 16,
        }}>
          <CheckCircle2 size={20} color="#22c55e" />
          <span style={{ color: "#22c55e", fontSize: 14, fontWeight: 600 }}>{result.message}</span>
        </div>
      )}

      {error && (
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)",
          borderRadius: 10, padding: "14px 18px", marginBottom: 16,
        }}>
          <AlertTriangle size={20} color="#ef4444" />
          <span style={{ color: "#ef4444", fontSize: 14 }}>{error}</span>
        </div>
      )}

      {/* Confirmação */}
      <div style={card}>
        <h2 style={h2}>Confirmar operação</h2>
        <p style={{ ...label, marginBottom: 14, lineHeight: 1.6 }}>
          Para prosseguir, escreva exatamente{" "}
          <code style={{
            background: "#1e2d50", color: "#f5a623",
            padding: "2px 8px", borderRadius: 4, fontSize: 13, fontWeight: 700,
          }}>
            {CONFIRM_PHRASE}
          </code>{" "}
          no campo abaixo:
        </p>

        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={CONFIRM_PHRASE}
          disabled={loading}
          style={{
            width: "100%", background: "#0a0f1e",
            border: `1px solid ${confirmed ? "#22c55e" : "#1e2d50"}`,
            borderRadius: 8, padding: "11px 14px", color: "#ffffff",
            fontSize: 14, outline: "none", boxSizing: "border-box",
            marginBottom: 16, letterSpacing: 1, fontFamily: "monospace",
          }}
        />

        <button
          onClick={handleReset}
          disabled={!confirmed || loading}
          style={{
            width: "100%", display: "flex", alignItems: "center",
            justifyContent: "center", gap: 10,
            background: confirmed && !loading ? "#dc2626" : "#4b1c1c",
            color: "#fff", border: "none", borderRadius: 8,
            padding: "12px 16px", fontSize: 15, fontWeight: 800,
            cursor: confirmed && !loading ? "pointer" : "not-allowed",
            transition: "background 0.2s",
          }}
        >
          <Trash2 size={18} />
          {loading ? "A executar reset..." : "Apagar todos os dados"}
        </button>

        {!confirmed && (
          <p style={{ ...label, fontSize: 12, marginTop: 10, textAlign: "center" }}>
            O botão ativa após escrever a frase de confirmação
          </p>
        )}
      </div>
    </div>
  );
}
