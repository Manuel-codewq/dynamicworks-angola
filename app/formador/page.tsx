"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { CheckCircle, AlertCircle, Send, BookOpen, Calendar, ChevronDown, ChevronUp } from "lucide-react";

type Report = {
  id: string; date: string; feito: string; videoPublicado: boolean;
  videoTitulo: string | null; reacoes: number | null;
  duvidasMembros: string | null; planoAmanha: string | null; createdAt: string;
};

export default function FormadorPage() {
  const { data: session, status } = useSession();
  const router  = useRouter();
  const user    = session?.user as any;

  const [feito,          setFeito]          = useState("");
  const [videoPublicado, setVideoPublicado] = useState(false);
  const [videoTitulo,    setVideoTitulo]    = useState("");
  const [reacoes,        setReacoes]        = useState("");
  const [duvidas,        setDuvidas]        = useState("");
  const [planoAmanha,    setPlanoAmanha]    = useState("");
  const [saving,         setSaving]         = useState(false);
  const [msg,            setMsg]            = useState<{ text: string; ok: boolean } | null>(null);
  const [reports,        setReports]        = useState<Report[]>([]);
  const [expanded,       setExpanded]       = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const todayReport = reports.find(r => r.date === today);

  useEffect(() => {
    if (status === "unauthenticated") { router.replace("/login"); return; }
    if (status === "authenticated" && user?.role !== "formador" && user?.role !== "admin") {
      router.replace("/trade");
    }
  }, [status, user, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/formador/report")
      .then(r => r.json())
      .then(d => {
        setReports(d.reports || []);
        const t = d.reports?.find((r: Report) => r.date === today);
        if (t) {
          setFeito(t.feito);
          setVideoPublicado(t.videoPublicado);
          setVideoTitulo(t.videoTitulo || "");
          setReacoes(t.reacoes?.toString() || "");
          setDuvidas(t.duvidasMembros || "");
          setPlanoAmanha(t.planoAmanha || "");
        }
      });
  }, [status, today]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/formador/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feito, videoPublicado, videoTitulo, reacoes: reacoes ? Number(reacoes) : null, duvidasMembros: duvidas, planoAmanha }),
    });
    const data = await res.json();
    if (res.ok) {
      setMsg({ text: "Relatório guardado com sucesso!", ok: true });
      setReports(prev => {
        const filtered = prev.filter(r => r.date !== today);
        return [data.report, ...filtered];
      });
    } else {
      setMsg({ text: data.error || "Erro ao guardar", ok: false });
    }
    setSaving(false);
  }

  if (status === "loading") return null;

  const inp: React.CSSProperties = {
    width: "100%", background: "#0a0f1e", border: "1px solid #1e2d50",
    borderRadius: 8, padding: "10px 12px", color: "#fff",
    fontSize: 14, outline: "none", boxSizing: "border-box",
  };
  const lbl: React.CSSProperties = { color: "#94a3b8", fontSize: 13, display: "block", marginBottom: 5 };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1e", fontFamily: "system-ui, sans-serif", padding: 20 }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
          <BookOpen size={28} color="#f5a623" />
          <div>
            <div style={{ color: "#fff", fontSize: 20, fontWeight: 800 }}>Área do Formador</div>
            <div style={{ color: "#94a3b8", fontSize: 13 }}>Olá, {user?.name?.split(" ")[0]} — {today}</div>
          </div>
        </div>

        {/* Formulário de relatório */}
        <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, padding: 24, marginBottom: 24 }}>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
            {todayReport ? "Actualizar relatório de hoje" : "Relatório de hoje"}
          </div>
          <div style={{ color: "#94a3b8", fontSize: 13, marginBottom: 20 }}>
            Preenche antes de terminar o dia. Podes actualizar até meia-noite.
          </div>

          {msg && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8, padding: "10px 14px",
              borderRadius: 8, marginBottom: 16,
              background: msg.ok ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
              border: `1px solid ${msg.ok ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
            }}>
              {msg.ok ? <CheckCircle size={15} color="#22c55e" /> : <AlertCircle size={15} color="#ef4444" />}
              <span style={{ color: msg.ok ? "#22c55e" : "#ef4444", fontSize: 13 }}>{msg.text}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>O que fizeste hoje? <span style={{ color: "#ef4444" }}>*</span></label>
              <textarea value={feito} onChange={e => setFeito(e.target.value)} rows={4} required
                placeholder="Ex: Gravei o vídeo sobre como abrir conta, respondi às dúvidas do grupo, partilhei o link da plataforma..."
                style={{ ...inp, resize: "vertical" }} />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <input type="checkbox" id="vid" checked={videoPublicado} onChange={e => setVideoPublicado(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: "#f5a623", cursor: "pointer" }} />
              <label htmlFor="vid" style={{ color: "#fff", fontSize: 14, cursor: "pointer" }}>
                Publiquei um vídeo hoje no grupo
              </label>
            </div>

            {videoPublicado && (
              <div style={{ marginBottom: 14 }}>
                <label style={lbl}>Título do vídeo</label>
                <input type="text" value={videoTitulo} onChange={e => setVideoTitulo(e.target.value)}
                  placeholder="Ex: Como fazer depósito na Dynamic Works" style={inp} />
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label style={lbl}>Reacções no grupo (nº)</label>
                <input type="number" min={0} value={reacoes} onChange={e => setReacoes(e.target.value)}
                  placeholder="Ex: 24" style={inp} />
              </div>
              <div>
                <label style={lbl}>Dúvidas mais frequentes</label>
                <input type="text" value={duvidas} onChange={e => setDuvidas(e.target.value)}
                  placeholder="Ex: Como levantar dinheiro?" style={inp} />
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={lbl}>Plano para amanhã</label>
              <input type="text" value={planoAmanha} onChange={e => setPlanoAmanha(e.target.value)}
                placeholder="Ex: Vídeo sobre gestão de saldo" style={inp} />
            </div>

            <button type="submit" disabled={saving}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                background: saving ? "#7a5118" : "#f5a623", color: "#0a0f1e",
                border: "none", borderRadius: 8, padding: "11px 24px",
                fontWeight: 700, fontSize: 14, cursor: saving ? "not-allowed" : "pointer",
              }}>
              <Send size={15} />
              {saving ? "A guardar..." : todayReport ? "Actualizar relatório" : "Enviar relatório"}
            </button>
          </form>
        </div>

        {/* Histórico */}
        {reports.length > 0 && (
          <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <Calendar size={17} color="#f5a623" />
              <span style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>Histórico dos meus relatórios</span>
            </div>
            {reports.map(r => (
              <div key={r.id} style={{ borderBottom: "1px solid #1e2d50", paddingBottom: 12, marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                  onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{
                      background: r.date === today ? "rgba(245,166,35,0.15)" : "rgba(30,45,80,0.6)",
                      color: r.date === today ? "#f5a623" : "#94a3b8",
                      border: `1px solid ${r.date === today ? "rgba(245,166,35,0.3)" : "#1e2d50"}`,
                      borderRadius: 6, padding: "2px 10px", fontSize: 12, fontWeight: 700,
                    }}>{r.date}</span>
                    {r.videoPublicado && (
                      <span style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 6, padding: "2px 8px", fontSize: 11 }}>
                        Vídeo publicado
                      </span>
                    )}
                  </div>
                  {expanded === r.id ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
                </div>
                {expanded === r.id && (
                  <div style={{ marginTop: 12, paddingLeft: 4 }}>
                    <p style={{ color: "#e2e8f0", fontSize: 13, margin: "0 0 8px" }}><span style={{ color: "#94a3b8" }}>Feito: </span>{r.feito}</p>
                    {r.videoTitulo && <p style={{ color: "#e2e8f0", fontSize: 13, margin: "0 0 8px" }}><span style={{ color: "#94a3b8" }}>Vídeo: </span>{r.videoTitulo}</p>}
                    {r.reacoes != null && <p style={{ color: "#e2e8f0", fontSize: 13, margin: "0 0 8px" }}><span style={{ color: "#94a3b8" }}>Reacções: </span>{r.reacoes}</p>}
                    {r.duvidasMembros && <p style={{ color: "#e2e8f0", fontSize: 13, margin: "0 0 8px" }}><span style={{ color: "#94a3b8" }}>Dúvidas: </span>{r.duvidasMembros}</p>}
                    {r.planoAmanha && <p style={{ color: "#e2e8f0", fontSize: 13, margin: "0" }}><span style={{ color: "#94a3b8" }}>Plano amanhã: </span>{r.planoAmanha}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
