"use client";
import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { CheckCircle, AlertCircle, Send, TrendingUp, Calendar, ChevronDown, ChevronUp, Upload, Image as ImageIcon } from "lucide-react";

type Report = {
  id: string; date: string; operacoes: number | null; lucro: number | null;
  paresNegociados: string | null; estrategia: string | null;
  observacoes: string; planoAmanha: string | null; imagemProva: string | null; createdAt: string;
};

export default function TraderPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const user   = session?.user as any;
  const fileRef = useRef<HTMLInputElement>(null);

  const [operacoes,       setOperacoes]       = useState("");
  const [lucro,           setLucro]           = useState("");
  const [pares,           setPares]           = useState("");
  const [estrategia,      setEstrategia]      = useState("");
  const [observacoes,     setObservacoes]     = useState("");
  const [planoAmanha,     setPlanoAmanha]     = useState("");
  const [imagemProva,     setImagemProva]     = useState("");
  const [uploading,       setUploading]       = useState(false);
  const [saving,          setSaving]          = useState(false);
  const [msg,             setMsg]             = useState<{ text: string; ok: boolean } | null>(null);
  const [reports,         setReports]         = useState<Report[]>([]);
  const [expanded,        setExpanded]        = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const todayReport = reports.find(r => r.date === today);

  useEffect(() => {
    if (status === "unauthenticated") { router.replace("/login"); return; }
    if (status === "authenticated" && user?.role !== "trader" && user?.role !== "admin") router.replace("/trade");
  }, [status, user, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/trader/report").then(r => r.json()).then(d => {
      setReports(d.reports || []);
      const t = d.reports?.find((r: Report) => r.date === today);
      if (t) { setOperacoes(t.operacoes?.toString() || ""); setLucro(t.lucro?.toString() || ""); setPares(t.paresNegociados || ""); setEstrategia(t.estrategia || ""); setObservacoes(t.observacoes); setPlanoAmanha(t.planoAmanha || ""); setImagemProva(t.imagemProva || ""); }
    });
  }, [status, today]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setMsg({ text: "Imagem demasiado grande (máx. 5MB)", ok: false }); return; }
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("folder", "provas");
    const res  = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (data.url) { setImagemProva(data.url); setMsg({ text: "Prova carregada com sucesso!", ok: true }); }
    else setMsg({ text: "Erro ao carregar imagem", ok: false });
    setUploading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setMsg(null);
    const res = await fetch("/api/trader/report", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operacoes: operacoes || null, lucro: lucro || null, paresNegociados: pares, estrategia, observacoes, planoAmanha, imagemProva: imagemProva || null }),
    });
    const data = await res.json();
    if (res.ok) { setMsg({ text: "Relatório guardado!", ok: true }); setReports(prev => [data.report, ...prev.filter(r => r.date !== today)]); }
    else setMsg({ text: data.error || "Erro ao guardar", ok: false });
    setSaving(false);
  }

  if (status === "loading") return null;

  const inp: React.CSSProperties = { width: "100%", background: "#0a0f1e", border: "1px solid #1e2d50", borderRadius: 8, padding: "10px 12px", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box" };
  const lbl: React.CSSProperties = { color: "#94a3b8", fontSize: 13, display: "block", marginBottom: 5 };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1e", fontFamily: "system-ui, sans-serif", padding: 20 }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
          <TrendingUp size={28} color="#22c55e" />
          <div>
            <div style={{ color: "#fff", fontSize: 20, fontWeight: 800 }}>Área do Trader</div>
            <div style={{ color: "#94a3b8", fontSize: 13 }}>Olá, {user?.name?.split(" ")[0]} — {today}</div>
          </div>
        </div>

        <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, padding: 24, marginBottom: 24 }}>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{todayReport ? "Actualizar relatório de hoje" : "Relatório de hoje"}</div>
          <div style={{ color: "#94a3b8", fontSize: 13, marginBottom: 20 }}>Preenche no final do dia. Podes actualizar até meia-noite.</div>

          {msg && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 8, marginBottom: 16, background: msg.ok ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${msg.ok ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}` }}>
              {msg.ok ? <CheckCircle size={15} color="#22c55e" /> : <AlertCircle size={15} color="#ef4444" />}
              <span style={{ color: msg.ok ? "#22c55e" : "#ef4444", fontSize: 13 }}>{msg.text}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div><label style={lbl}>Nº de operações</label><input type="number" min={0} value={operacoes} onChange={e => setOperacoes(e.target.value)} placeholder="Ex: 12" style={inp} /></div>
              <div><label style={lbl}>Lucro/Prejuízo (Kz)</label><input type="number" value={lucro} onChange={e => setLucro(e.target.value)} placeholder="Ex: 15000" style={inp} /></div>
            </div>
            <div style={{ marginBottom: 14 }}><label style={lbl}>Pares negociados</label><input type="text" value={pares} onChange={e => setPares(e.target.value)} placeholder="Ex: EUR/USD, BTC/USD" style={inp} /></div>
            <div style={{ marginBottom: 14 }}><label style={lbl}>Estratégia usada</label><input type="text" value={estrategia} onChange={e => setEstrategia(e.target.value)} placeholder="Ex: Suporte/Resistência, Médias móveis" style={inp} /></div>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Observações do dia <span style={{ color: "#ef4444" }}>*</span></label>
              <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={3} required placeholder="Como correu o dia? O que aprendeste?" style={{ ...inp, resize: "vertical" }} />
            </div>
            <div style={{ marginBottom: 14 }}><label style={lbl}>Plano para amanhã</label><input type="text" value={planoAmanha} onChange={e => setPlanoAmanha(e.target.value)} placeholder="Ex: Focar no par GBP/USD" style={inp} /></div>

            {/* Upload de prova */}
            <div style={{ marginBottom: 20 }}>
              <label style={lbl}>Prova (print/screenshot)</label>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} style={{ display: "none" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                  style={{ display: "flex", alignItems: "center", gap: 7, background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.3)", color: "#38bdf8", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: uploading ? "not-allowed" : "pointer" }}>
                  <Upload size={14} /> {uploading ? "A carregar..." : "Carregar print"}
                </button>
                {imagemProva && <a href={imagemProva} target="_blank" rel="noopener" style={{ display: "flex", alignItems: "center", gap: 5, color: "#22c55e", fontSize: 13 }}><ImageIcon size={14} /> Ver prova</a>}
              </div>
              {imagemProva && <img src={imagemProva} alt="prova" style={{ marginTop: 8, maxWidth: "100%", maxHeight: 200, borderRadius: 8, border: "1px solid #1e2d50", objectFit: "contain" }} />}
            </div>

            <button type="submit" disabled={saving}
              style={{ display: "flex", alignItems: "center", gap: 8, background: saving ? "#145a28" : "#22c55e", color: "#000", border: "none", borderRadius: 8, padding: "11px 24px", fontWeight: 700, fontSize: 14, cursor: saving ? "not-allowed" : "pointer" }}>
              <Send size={15} /> {saving ? "A guardar..." : todayReport ? "Actualizar relatório" : "Enviar relatório"}
            </button>
          </form>
        </div>

        {reports.length > 0 && (
          <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}><Calendar size={17} color="#22c55e" /><span style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>Histórico</span></div>
            {reports.map(r => (
              <div key={r.id} style={{ borderBottom: "1px solid #1e2d50", paddingBottom: 12, marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ background: r.date === today ? "rgba(34,197,94,0.15)" : "rgba(30,45,80,0.6)", color: r.date === today ? "#22c55e" : "#94a3b8", border: `1px solid ${r.date === today ? "rgba(34,197,94,0.3)" : "#1e2d50"}`, borderRadius: 6, padding: "2px 10px", fontSize: 12, fontWeight: 700 }}>{r.date}</span>
                    {r.operacoes != null && <span style={{ color: "#94a3b8", fontSize: 12 }}>{r.operacoes} operações</span>}
                    {r.lucro != null && <span style={{ color: r.lucro >= 0 ? "#22c55e" : "#ef4444", fontSize: 12, fontWeight: 700 }}>{r.lucro >= 0 ? "+" : ""}{r.lucro.toLocaleString("pt-PT")} Kz</span>}
                    {r.imagemProva && <span style={{ background: "rgba(56,189,248,0.1)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.3)", borderRadius: 6, padding: "2px 8px", fontSize: 11 }}>Prova</span>}
                  </div>
                  {expanded === r.id ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
                </div>
                {expanded === r.id && (
                  <div style={{ marginTop: 12, background: "#0a0f1e", borderRadius: 10, padding: 16 }}>
                    {r.paresNegociados && <p style={{ color: "#e2e8f0", fontSize: 13, margin: "0 0 8px" }}><span style={{ color: "#94a3b8" }}>Pares: </span>{r.paresNegociados}</p>}
                    {r.estrategia && <p style={{ color: "#e2e8f0", fontSize: 13, margin: "0 0 8px" }}><span style={{ color: "#94a3b8" }}>Estratégia: </span>{r.estrategia}</p>}
                    <p style={{ color: "#e2e8f0", fontSize: 13, margin: "0 0 8px" }}><span style={{ color: "#94a3b8" }}>Observações: </span>{r.observacoes}</p>
                    {r.planoAmanha && <p style={{ color: "#f5a623", fontSize: 13, margin: "0 0 8px" }}><span style={{ color: "#94a3b8" }}>Amanhã: </span>{r.planoAmanha}</p>}
                    {r.imagemProva && <img src={r.imagemProva} alt="prova" style={{ marginTop: 8, maxWidth: "100%", maxHeight: 200, borderRadius: 8, border: "1px solid #1e2d50", objectFit: "contain" }} />}
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
