"use client";
import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { CheckCircle, AlertCircle, Send, BookOpen, TrendingUp, Megaphone, Calendar, ChevronDown, ChevronUp, Upload, Image as ImageIcon } from "lucide-react";

type Area = "formacao" | "trading" | "marketing";

type FormacaoReport = { id: string; date: string; feito: string; videoPublicado: boolean; videoTitulo: string | null; reacoes: number | null; duvidasMembros: string | null; planoAmanha: string | null; imagemProva: string | null; };
type TraderReport   = { id: string; date: string; operacoes: number | null; lucro: number | null; paresNegociados: string | null; estrategia: string | null; observacoes: string; planoAmanha: string | null; imagemProva: string | null; };
type MarketingReport= { id: string; date: string; conteudoCriado: string | null; plataforma: string | null; visualizacoes: number | null; leadsGerados: number | null; proximoConteudo: string | null; observacoes: string | null; imagemProva: string | null; };

const AREAS: { key: Area; label: string; icon: React.ReactNode; color: string; roles: string[] }[] = [
  { key: "formacao", label: "Formação",  icon: <BookOpen  size={16} />, color: "#ffffff", roles: ["formador", "admin"] },
  { key: "trading",  label: "Trading",   icon: <TrendingUp size={16} />, color: "#22c55e", roles: ["trader",   "admin"] },
  { key: "marketing",label: "Marketing", icon: <Megaphone  size={16} />, color: "#a78bfa", roles: ["marketing","admin"] },
];

const PLATAFORMAS = ["Instagram", "TikTok", "WhatsApp", "Facebook", "YouTube", "Outra"];

export default function EquipaPage() {
  const { data: session, status } = useSession();
  const router  = useRouter();
  const user    = session?.user as any;
  const fileRef = useRef<HTMLInputElement>(null);

  const ROLES_ALLOWED = ["formador", "trader", "marketing", "admin"];

  useEffect(() => {
    if (status === "unauthenticated") { router.replace("/login"); return; }
    if (status === "authenticated" && !ROLES_ALLOWED.includes(user?.role)) router.replace("/trade");
  }, [status, user, router]);

  // Determina as abas disponíveis para este utilizador
  const availableAreas = AREAS.filter(a => a.roles.includes(user?.role || ""));
  const [area, setArea] = useState<Area | null>(null);

  useEffect(() => {
    if (availableAreas.length > 0 && !area) setArea(availableAreas[0].key);
  }, [user?.role]);

  // ── Estado dos formulários ──────────────────────────────────────────
  // Formação
  const [feito,          setFeito]          = useState("");
  const [videoPublicado, setVideoPublicado] = useState(false);
  const [videoTitulo,    setVideoTitulo]    = useState("");
  const [reacoes,        setReacoes]        = useState("");
  const [duvidas,        setDuvidas]        = useState("");

  // Trading
  const [operacoes,   setOperacoes]   = useState("");
  const [lucro,       setLucro]       = useState("");
  const [pares,       setPares]       = useState("");
  const [estrategia,  setEstrategia]  = useState("");
  const [observacoes, setObservacoes] = useState("");

  // Marketing
  const [conteudo,      setConteudo]      = useState("");
  const [plataforma,    setPlataforma]    = useState("");
  const [visualizacoes, setVisualizacoes] = useState("");
  const [leads,         setLeads]         = useState("");
  const [proximo,       setProximo]       = useState("");
  const [obsMarketing,  setObsMarketing]  = useState("");

  // Comum
  const [planoAmanha,  setPlanoAmanha]  = useState("");
  const [imagemProva,  setImagemProva]  = useState("");
  const [uploading,    setUploading]    = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [msg,          setMsg]          = useState<{ text: string; ok: boolean } | null>(null);
  const [expanded,     setExpanded]     = useState<string | null>(null);

  // Histórico por área
  const [histFormacao,  setHistFormacao]  = useState<FormacaoReport[]>([]);
  const [histTrading,   setHistTrading]   = useState<TraderReport[]>([]);
  const [histMarketing, setHistMarketing] = useState<MarketingReport[]>([]);

  const today = new Date().toISOString().slice(0, 10);

  // Carrega histórico ao mudar de área
  useEffect(() => {
    if (status !== "authenticated" || !area) return;
    const endpoints: Record<Area, string> = { formacao: "/api/formador/report", trading: "/api/trader/report", marketing: "/api/marketing/report" };
    fetch(endpoints[area]).then(r => r.json()).then(d => {
      const reports = d.reports || [];
      if (area === "formacao")  setHistFormacao(reports);
      if (area === "trading")   setHistTrading(reports);
      if (area === "marketing") setHistMarketing(reports);

      // Pré-preenche com relatório de hoje se existir
      const t = reports.find((r: any) => r.date === today);
      setImagemProva(t?.imagemProva || "");
      setPlanoAmanha(t?.planoAmanha || "");
      if (area === "formacao" && t) { setFeito(t.feito || ""); setVideoPublicado(t.videoPublicado || false); setVideoTitulo(t.videoTitulo || ""); setReacoes(t.reacoes?.toString() || ""); setDuvidas(t.duvidasMembros || ""); }
      if (area === "trading"  && t) { setOperacoes(t.operacoes?.toString() || ""); setLucro(t.lucro?.toString() || ""); setPares(t.paresNegociados || ""); setEstrategia(t.estrategia || ""); setObservacoes(t.observacoes || ""); }
      if (area === "marketing"&& t) { setConteudo(t.conteudoCriado || ""); setPlataforma(t.plataforma || ""); setVisualizacoes(t.visualizacoes?.toString() || ""); setLeads(t.leadsGerados?.toString() || ""); setProximo(t.proximoConteudo || ""); setObsMarketing(t.observacoes || ""); }
    });
  }, [status, area, today]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setMsg({ text: "Imagem demasiado grande (máx. 2MB)", ok: false }); return; }
    setUploading(true);
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const res  = await fetch("/api/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ file: base64, folder: "provas" }) });
    const data = await res.json();
    if (data.url) { setImagemProva(data.url); setMsg({ text: "Prova carregada!", ok: true }); }
    else setMsg({ text: data.error || "Erro ao carregar imagem", ok: false });
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (area === "formacao" && !imagemProva) {
      setMsg({ text: "A prova (print/screenshot) é obrigatória.", ok: false });
      return;
    }
    setSaving(true); setMsg(null);
    const endpoints: Record<Area, string> = { formacao: "/api/formador/report", trading: "/api/trader/report", marketing: "/api/marketing/report" };
    const bodies: Record<Area, object> = {
      formacao:  { feito, videoPublicado, videoTitulo, reacoes: reacoes || null, duvidasMembros: duvidas, planoAmanha, imagemProva: imagemProva || null },
      trading:   { operacoes: operacoes || null, lucro: lucro || null, paresNegociados: pares, estrategia, observacoes, planoAmanha, imagemProva: imagemProva || null },
      marketing: { conteudoCriado: conteudo, plataforma, visualizacoes: visualizacoes || null, leadsGerados: leads || null, proximoConteudo: proximo, observacoes: obsMarketing, planoAmanha, imagemProva: imagemProva || null },
    };
    const res  = await fetch(endpoints[area!], { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bodies[area!]) });
    const data = await res.json();
    if (res.ok) {
      setMsg({ text: "Relatório guardado com sucesso!", ok: true });
      if (area === "formacao")  setHistFormacao(prev  => [data.report, ...prev.filter((r: any) => r.date !== today)]);
      if (area === "trading")   setHistTrading(prev   => [data.report, ...prev.filter((r: any) => r.date !== today)]);
      if (area === "marketing") setHistMarketing(prev => [data.report, ...prev.filter((r: any) => r.date !== today)]);
    } else { setMsg({ text: data.error || "Erro ao guardar", ok: false }); }
    setSaving(false);
  }

  if (status === "loading" || !area) return null;

  const areaInfo  = AREAS.find(a => a.key === area)!;
  const todayHist = area === "formacao" ? histFormacao : area === "trading" ? histTrading : histMarketing;
  const todayRep  = todayHist.find(r => r.date === today);

  const inp: React.CSSProperties = { width: "100%", background: "#0a0f1e", border: "1px solid #1e2d50", borderRadius: 8, padding: "10px 12px", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box" };
  const lbl: React.CSSProperties = { color: "#94a3b8", fontSize: 13, display: "block", marginBottom: 5 };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1e", fontFamily: "system-ui, sans-serif", padding: 20 }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <div style={{ color: areaInfo.color }}>{areaInfo.icon && <span style={{ fontSize: 28 }}>{areaInfo.icon}</span>}</div>
          <div>
            <div style={{ color: "#fff", fontSize: 20, fontWeight: 800 }}>Área da Equipa</div>
            <div style={{ color: "#94a3b8", fontSize: 13 }}>Olá, {user?.name?.split(" ")[0]} — {today}</div>
          </div>
        </div>

        {/* Tabs de área */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          {availableAreas.map(a => (
            <button key={a.key} onClick={() => { setArea(a.key); setMsg(null); setExpanded(null); }}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "10px 18px", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer",
                border: `2px solid ${area === a.key ? a.color : "#1e2d50"}`,
                background: area === a.key ? `${a.color}18` : "#111827",
                color: area === a.key ? a.color : "#94a3b8",
                transition: "all 0.15s",
              }}>
              {a.icon} {a.label}
            </button>
          ))}
        </div>

        {/* Formulário */}
        <div style={{ background: "#111827", border: `1px solid ${areaInfo.color}30`, borderRadius: 14, padding: 24, marginBottom: 24 }}>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
            {todayRep ? `Actualizar relatório de ${areaInfo.label} de hoje` : `Relatório de ${areaInfo.label} — hoje`}
          </div>
          <div style={{ color: "#94a3b8", fontSize: 13, marginBottom: 20 }}>Podes actualizar até meia-noite.</div>

          {msg && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 8, marginBottom: 16, background: msg.ok ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${msg.ok ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}` }}>
              {msg.ok ? <CheckCircle size={15} color="#22c55e" /> : <AlertCircle size={15} color="#ef4444" />}
              <span style={{ color: msg.ok ? "#22c55e" : "#ef4444", fontSize: 13 }}>{msg.text}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* ── FORMAÇÃO ── */}
            {area === "formacao" && (<>
              <div style={{ marginBottom: 14 }}>
                <label style={lbl}>O que fizeste hoje? <span style={{ color: "#ef4444" }}>*</span></label>
                <textarea value={feito} onChange={e => setFeito(e.target.value)} rows={4} required placeholder="Ex: Gravei vídeo sobre como abrir conta, respondi às dúvidas do grupo..." style={{ ...inp, resize: "vertical" }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <input type="checkbox" id="vid" checked={videoPublicado} onChange={e => setVideoPublicado(e.target.checked)} style={{ width: 16, height: 16, accentColor: "#ffffff", cursor: "pointer" }} />
                <label htmlFor="vid" style={{ color: "#fff", fontSize: 14, cursor: "pointer" }}>Publiquei um vídeo hoje no grupo</label>
              </div>
              {videoPublicado && (
                <div style={{ marginBottom: 14 }}>
                  <label style={lbl}>Título do vídeo <span style={{ color: "#ef4444" }}>*</span></label>
                  <input type="text" value={videoTitulo} onChange={e => setVideoTitulo(e.target.value)} required placeholder="Ex: Como fazer depósito na Dynamic Works" style={inp} />
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={lbl}>Reacções no grupo <span style={{ color: "#ef4444" }}>*</span></label>
                  <input type="number" min={0} value={reacoes} onChange={e => setReacoes(e.target.value)} required placeholder="Ex: 24" style={inp} />
                </div>
                <div>
                  <label style={lbl}>Dúvidas mais frequentes <span style={{ color: "#ef4444" }}>*</span></label>
                  <input type="text" value={duvidas} onChange={e => setDuvidas(e.target.value)} required placeholder="Ex: Como levantar?" style={inp} />
                </div>
              </div>
            </>)}

            {/* ── TRADING ── */}
            {area === "trading" && (<>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div><label style={lbl}>Nº de operações</label><input type="number" min={0} value={operacoes} onChange={e => setOperacoes(e.target.value)} placeholder="Ex: 12" style={inp} /></div>
                <div><label style={lbl}>Lucro/Prejuízo (Kz)</label><input type="number" value={lucro} onChange={e => setLucro(e.target.value)} placeholder="Ex: 15000" style={inp} /></div>
              </div>
              <div style={{ marginBottom: 14 }}><label style={lbl}>Pares negociados</label><input type="text" value={pares} onChange={e => setPares(e.target.value)} placeholder="Ex: EUR/USD, BTC/USD" style={inp} /></div>
              <div style={{ marginBottom: 14 }}><label style={lbl}>Estratégia usada</label><input type="text" value={estrategia} onChange={e => setEstrategia(e.target.value)} placeholder="Ex: Suporte/Resistência" style={inp} /></div>
              <div style={{ marginBottom: 14 }}>
                <label style={lbl}>Observações do dia <span style={{ color: "#ef4444" }}>*</span></label>
                <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={3} required placeholder="Como correu o dia?" style={{ ...inp, resize: "vertical" }} />
              </div>
            </>)}

            {/* ── MARKETING ── */}
            {area === "marketing" && (<>
              <div style={{ marginBottom: 14 }}>
                <label style={lbl}>Conteúdo criado hoje <span style={{ color: "#ef4444" }}>*</span></label>
                <textarea value={conteudo} onChange={e => setConteudo(e.target.value)} rows={3} required placeholder="Ex: Vídeo sobre como criar conta na Dynamic Works..." style={{ ...inp, resize: "vertical" }} />
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
              <div style={{ marginBottom: 14 }}><label style={lbl}>Observações</label><input type="text" value={obsMarketing} onChange={e => setObsMarketing(e.target.value)} placeholder="Algo importante a destacar?" style={inp} /></div>
            </>)}

            {/* Plano amanhã — comum */}
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Plano para amanhã {area === "formacao" && <span style={{ color: "#ef4444" }}>*</span>}</label>
              <input type="text" value={planoAmanha} onChange={e => setPlanoAmanha(e.target.value)} required={area === "formacao"} placeholder="O que vais fazer amanhã?" style={inp} />
            </div>

            {/* Upload de prova — comum */}
            <div style={{ marginBottom: 20 }}>
              <label style={lbl}>Prova (print/screenshot) {area === "formacao" && <span style={{ color: "#ef4444" }}>*</span>}</label>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} style={{ display: "none" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                  style={{ display: "flex", alignItems: "center", gap: 7, background: `${areaInfo.color}18`, border: `1px solid ${areaInfo.color}50`, color: areaInfo.color, borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: uploading ? "not-allowed" : "pointer" }}>
                  <Upload size={14} /> {uploading ? "A carregar..." : "Carregar print"}
                </button>
                {imagemProva && <a href={imagemProva} target="_blank" rel="noopener" style={{ display: "flex", alignItems: "center", gap: 5, color: "#22c55e", fontSize: 13 }}><ImageIcon size={14} /> Ver prova</a>}
              </div>
              {imagemProva && <img src={imagemProva} alt="prova" style={{ marginTop: 8, maxWidth: "100%", maxHeight: 200, borderRadius: 8, border: "1px solid #1e2d50", objectFit: "contain" }} />}
            </div>

            <button type="submit" disabled={saving}
              style={{ display: "flex", alignItems: "center", gap: 8, background: saving ? "#333" : areaInfo.color, color: area === "marketing" ? "#fff" : "#0a0f1e", border: "none", borderRadius: 8, padding: "11px 24px", fontWeight: 700, fontSize: 14, cursor: saving ? "not-allowed" : "pointer" }}>
              <Send size={15} /> {saving ? "A guardar..." : todayRep ? "Actualizar relatório" : "Enviar relatório"}
            </button>
          </form>
        </div>

        {/* Histórico */}
        {todayHist.length > 0 && (
          <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <Calendar size={17} color={areaInfo.color} />
              <span style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>Histórico — {areaInfo.label}</span>
            </div>
            {todayHist.map((r: any) => (
              <div key={r.id} style={{ borderBottom: "1px solid #1e2d50", paddingBottom: 12, marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ background: r.date === today ? `${areaInfo.color}20` : "rgba(30,45,80,0.6)", color: r.date === today ? areaInfo.color : "#94a3b8", border: `1px solid ${r.date === today ? `${areaInfo.color}50` : "#1e2d50"}`, borderRadius: 6, padding: "2px 10px", fontSize: 12, fontWeight: 700 }}>{r.date}</span>
                    {area === "formacao"  && r.videoPublicado && <span style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 6, padding: "2px 8px", fontSize: 11 }}>Vídeo publicado</span>}
                    {area === "trading"  && r.lucro  != null && <span style={{ color: r.lucro >= 0 ? "#22c55e" : "#ef4444", fontSize: 12, fontWeight: 700 }}>{r.lucro >= 0 ? "+" : ""}{r.lucro.toLocaleString("pt-PT")} Kz</span>}
                    {area === "marketing"&& r.leadsGerados != null && <span style={{ color: "#22c55e", fontSize: 12, fontWeight: 700 }}>{r.leadsGerados} leads</span>}
                    {r.imagemProva && <span style={{ background: "rgba(56,189,248,0.1)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.3)", borderRadius: 6, padding: "2px 8px", fontSize: 11 }}>Prova</span>}
                  </div>
                  {expanded === r.id ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
                </div>
                {expanded === r.id && (
                  <div style={{ marginTop: 12, background: "#0a0f1e", borderRadius: 10, padding: 16 }}>
                    {area === "formacao"  && <><p style={{ color: "#e2e8f0", fontSize: 13, margin: "0 0 8px" }}><span style={{ color: "#94a3b8" }}>Feito: </span>{r.feito}</p>{r.videoTitulo && <p style={{ color: "#e2e8f0", fontSize: 13, margin: "0 0 8px" }}><span style={{ color: "#94a3b8" }}>Vídeo: </span>{r.videoTitulo}</p>}{r.duvidasMembros && <p style={{ color: "#e2e8f0", fontSize: 13, margin: "0 0 8px" }}><span style={{ color: "#94a3b8" }}>Dúvidas: </span>{r.duvidasMembros}</p>}</>}
                    {area === "trading"  && <><p style={{ color: "#e2e8f0", fontSize: 13, margin: "0 0 8px" }}><span style={{ color: "#94a3b8" }}>Observações: </span>{r.observacoes}</p>{r.paresNegociados && <p style={{ color: "#e2e8f0", fontSize: 13, margin: "0 0 8px" }}><span style={{ color: "#94a3b8" }}>Pares: </span>{r.paresNegociados}</p>}{r.estrategia && <p style={{ color: "#e2e8f0", fontSize: 13, margin: "0 0 8px" }}><span style={{ color: "#94a3b8" }}>Estratégia: </span>{r.estrategia}</p>}</>}
                    {area === "marketing"&& <><p style={{ color: "#e2e8f0", fontSize: 13, margin: "0 0 8px" }}><span style={{ color: "#94a3b8" }}>Conteúdo: </span>{r.conteudoCriado}</p>{r.plataforma && <p style={{ color: "#e2e8f0", fontSize: 13, margin: "0 0 8px" }}><span style={{ color: "#94a3b8" }}>Plataforma: </span>{r.plataforma}</p>}{r.observacoes && <p style={{ color: "#e2e8f0", fontSize: 13, margin: "0 0 8px" }}><span style={{ color: "#94a3b8" }}>Obs: </span>{r.observacoes}</p>}</>}
                    {r.planoAmanha && <p style={{ color: "#ffffff", fontSize: 13, margin: "0 0 8px" }}><span style={{ color: "#94a3b8" }}>Amanhã: </span>{r.planoAmanha}</p>}
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
