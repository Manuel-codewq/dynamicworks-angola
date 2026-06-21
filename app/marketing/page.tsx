"use client";
import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { CheckCircle, AlertCircle, Send, Megaphone, Calendar, ChevronDown, ChevronUp, Upload, Image as ImageIcon } from "lucide-react";

type Report = {
  id: string; date: string; conteudoCriado: string | null; plataforma: string | null;
  visualizacoes: number | null; leadsGerados: number | null;
  proximoConteudo: string | null; observacoes: string | null; imagemProva: string | null; createdAt: string;
};

const PLATAFORMAS = ["Instagram", "TikTok", "WhatsApp", "Facebook", "YouTube", "Outra"];

export default function MarketingPage() {
  const { data: session, status } = useSession();
  const router  = useRouter();
  const user    = session?.user as any;
  const fileRef = useRef<HTMLInputElement>(null);

  const [conteudo,     setConteudo]     = useState("");
  const [plataforma,   setPlataforma]   = useState("");
  const [visualizacoes,setVisualizacoes]= useState("");
  const [leads,        setLeads]        = useState("");
  const [proximo,      setProximo]      = useState("");
  const [observacoes,  setObservacoes]  = useState("");
  const [imagemProva,  setImagemProva]  = useState("");
  const [uploading,    setUploading]    = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [msg,          setMsg]          = useState<{ text: string; ok: boolean } | null>(null);
  const [reports,      setReports]      = useState<Report[]>([]);
  const [expanded,     setExpanded]     = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const todayReport = reports.find(r => r.date === today);

  useEffect(() => {
    if (status === "unauthenticated") { router.replace("/login"); return; }
    if (status === "authenticated" && user?.role !== "marketing" && user?.role !== "admin") router.replace("/trade");
  }, [status, user, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/marketing/report").then(r => r.json()).then(d => {
      setReports(d.reports || []);
      const t = d.reports?.find((r: Report) => r.date === today);
      if (t) { setConteudo(t.conteudoCriado || ""); setPlataforma(t.plataforma || ""); setVisualizacoes(t.visualizacoes?.toString() || ""); setLeads(t.leadsGerados?.toString() || ""); setProximo(t.proximoConteudo || ""); setObservacoes(t.observacoes || ""); setImagemProva(t.imagemProva || ""); }
    });
  }, [status, today]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setMsg({ text: "Imagem demasiado grande (máx. 5MB)", ok: false }); return; }
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file); fd.append("folder", "provas");
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (data.url) { setImagemProva(data.url); setMsg({ text: "Prova carregada!", ok: true }); }
    else setMsg({ text: "Erro ao carregar imagem", ok: false });
    setUploading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setMsg(null);
    const res = await fetch("/api/marketing/report", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conteudoCriado: conteudo, plataforma, visualizacoes: visualizacoes || null, leadsGerados: leads || null, proximoConteudo: proximo, observacoes, imagemProva: imagemProva || null }),
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
          <Megaphone size={28} color="#a78bfa" />
          <div>
            <div style={{ color: "#fff", fontSize: 20, fontWeight: 800 }}>Área de Marketing</div>
            <div style={{ color: "#94a3b8", fontSize: 13 }}>Olá, {user?.name?.split(" ")[0]} — {today}</div>
          </div>
        </div>

        <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, padding: 24, marginBottom: 24 }}>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{todayReport ? "Actualizar relatório de hoje" : "Relatório de hoje"}</div>
          <div style={{ color: "#94a3b8", fontSize: 13, marginBottom: 20 }}>Preenche no final do dia com o que fizeste.</div>

          {msg && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 8, marginBottom: 16, background: msg.ok ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${msg.ok ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}` }}>
              {msg.ok ? <CheckCircle size={15} color="#22c55e" /> : <AlertCircle size={15} color="#ef4444" />}
              <span style={{ color: msg.ok ? "#22c55e" : "#ef4444", fontSize: 13 }}>{msg.text}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Conteúdo criado hoje <span style={{ color: "#ef4444" }}>*</span></label>
              <textarea value={conteudo} onChange={e => setConteudo(e.target.value)} rows={3} required placeholder="Ex: Vídeo sobre como criar conta na Dynamic Works, post no Instagram sobre trading..." style={{ ...inp, resize: "vertical" }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label style={lbl}>Plataforma</label>
                <select value={plataforma} onChange={e => setPlataforma(e.target.value)} style={{ ...inp, appearance: "none", cursor: "pointer" }}>
                  <option value="">Seleccionar</option>
                  {PLATAFORMAS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Visualizações</label><input type="number" min={0} value={visualizacoes} onChange={e => setVisualizacoes(e.target.value)} placeholder="Ex: 1500" style={inp} /></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div><label style={lbl}>Leads gerados</label><input type="number" min={0} value={leads} onChange={e => setLeads(e.target.value)} placeholder="Ex: 23" style={inp} /></div>
              <div><label style={lbl}>Próximo conteúdo</label><input type="text" value={proximo} onChange={e => setProximo(e.target.value)} placeholder="Ex: Vídeo sobre depósito" style={inp} /></div>
            </div>
            <div style={{ marginBottom: 14 }}><label style={lbl}>Observações</label><input type="text" value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Algo importante a destacar?" style={inp} /></div>

            <div style={{ marginBottom: 20 }}>
              <label style={lbl}>Prova (print/screenshot)</label>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} style={{ display: "none" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                  style={{ display: "flex", alignItems: "center", gap: 7, background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.3)", color: "#a78bfa", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: uploading ? "not-allowed" : "pointer" }}>
                  <Upload size={14} /> {uploading ? "A carregar..." : "Carregar print"}
                </button>
                {imagemProva && <a href={imagemProva} target="_blank" rel="noopener" style={{ display: "flex", alignItems: "center", gap: 5, color: "#22c55e", fontSize: 13 }}><ImageIcon size={14} /> Ver prova</a>}
              </div>
              {imagemProva && <img src={imagemProva} alt="prova" style={{ marginTop: 8, maxWidth: "100%", maxHeight: 200, borderRadius: 8, border: "1px solid #1e2d50", objectFit: "contain" }} />}
            </div>

            <button type="submit" disabled={saving}
              style={{ display: "flex", alignItems: "center", gap: 8, background: saving ? "#4c3d80" : "#a78bfa", color: "#fff", border: "none", borderRadius: 8, padding: "11px 24px", fontWeight: 700, fontSize: 14, cursor: saving ? "not-allowed" : "pointer" }}>
              <Send size={15} /> {saving ? "A guardar..." : todayReport ? "Actualizar relatório" : "Enviar relatório"}
            </button>
          </form>
        </div>

        {reports.length > 0 && (
          <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}><Calendar size={17} color="#a78bfa" /><span style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>Histórico</span></div>
            {reports.map(r => (
              <div key={r.id} style={{ borderBottom: "1px solid #1e2d50", paddingBottom: 12, marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ background: r.date === today ? "rgba(167,139,250,0.15)" : "rgba(30,45,80,0.6)", color: r.date === today ? "#a78bfa" : "#94a3b8", border: `1px solid ${r.date === today ? "rgba(167,139,250,0.3)" : "#1e2d50"}`, borderRadius: 6, padding: "2px 10px", fontSize: 12, fontWeight: 700 }}>{r.date}</span>
                    {r.plataforma && <span style={{ color: "#94a3b8", fontSize: 12 }}>{r.plataforma}</span>}
                    {r.visualizacoes != null && <span style={{ color: "#94a3b8", fontSize: 12 }}>{r.visualizacoes} visualizações</span>}
                    {r.leadsGerados != null && <span style={{ color: "#22c55e", fontSize: 12, fontWeight: 700 }}>{r.leadsGerados} leads</span>}
                    {r.imagemProva && <span style={{ background: "rgba(56,189,248,0.1)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.3)", borderRadius: 6, padding: "2px 8px", fontSize: 11 }}>Prova</span>}
                  </div>
                  {expanded === r.id ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
                </div>
                {expanded === r.id && (
                  <div style={{ marginTop: 12, background: "#0a0f1e", borderRadius: 10, padding: 16 }}>
                    {r.conteudoCriado && <p style={{ color: "#e2e8f0", fontSize: 13, margin: "0 0 8px" }}><span style={{ color: "#94a3b8" }}>Conteúdo: </span>{r.conteudoCriado}</p>}
                    {r.observacoes && <p style={{ color: "#e2e8f0", fontSize: 13, margin: "0 0 8px" }}><span style={{ color: "#94a3b8" }}>Obs: </span>{r.observacoes}</p>}
                    {r.proximoConteudo && <p style={{ color: "#f5a623", fontSize: 13, margin: "0 0 8px" }}><span style={{ color: "#94a3b8" }}>Próximo: </span>{r.proximoConteudo}</p>}
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
