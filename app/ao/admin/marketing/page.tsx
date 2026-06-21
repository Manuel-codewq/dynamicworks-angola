"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Megaphone, Filter, ChevronDown, ChevronUp, Download, Image as ImageIcon } from "lucide-react";

type Report = {
  id: string; date: string; conteudoCriado: string | null; plataforma: string | null;
  visualizacoes: number | null; leadsGerados: number | null;
  proximoConteudo: string | null; observacoes: string | null; imagemProva: string | null;
  user: { id: string; name: string; email: string; avatar: string | null };
};
type Marketer = { id: string; name: string; email: string; avatar: string | null };

export default function AdminMarketingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const user   = session?.user as any;

  const [reports,    setReports]    = useState<Report[]>([]);
  const [marketers,  setMarketers]  = useState<Marketer[]>([]);
  const [filterUser, setFilterUser] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [expanded,   setExpanded]   = useState<string | null>(null);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") { router.replace("/login"); return; }
    if (status === "authenticated" && user?.role !== "admin") router.replace("/trade");
  }, [status, user, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    const p = new URLSearchParams();
    if (filterUser) p.set("userId", filterUser);
    if (filterDate) p.set("date", filterDate);
    setLoading(true);
    fetch(`/api/admin/marketing?${p}`).then(r => r.json()).then(d => { setReports(d.reports || []); setMarketers(d.marketers || []); setLoading(false); });
  }, [status, filterUser, filterDate]);

  function exportCSV() {
    const header = ["Nome", "Email", "Data", "Conteúdo criado", "Plataforma", "Visualizações", "Leads gerados", "Próximo conteúdo", "Observações", "URL Prova"];
    const rows = reports.map(r => [r.user.name, r.user.email, r.date, r.conteudoCriado ? `"${r.conteudoCriado.replace(/"/g,'""')}"` : "", r.plataforma ?? "", r.visualizacoes ?? "", r.leadsGerados ?? "", r.proximoConteudo ?? "", r.observacoes ?? "", r.imagemProva ?? ""]);
    const csv  = [header, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `marketing_${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  if (status === "loading") return null;
  const today = new Date().toISOString().slice(0, 10);
  const inp: React.CSSProperties = { background: "#0a0f1e", border: "1px solid #1e2d50", borderRadius: 8, padding: "8px 12px", color: "#fff", fontSize: 13, outline: "none" };
  const totalLeads  = reports.reduce((s, r) => s + (r.leadsGerados || 0), 0);
  const totalViews  = reports.reduce((s, r) => s + (r.visualizacoes || 0), 0);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1e", fontFamily: "system-ui, sans-serif", padding: 24 }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Megaphone size={28} color="#a78bfa" />
            <div><div style={{ color: "#fff", fontSize: 22, fontWeight: 800 }}>Relatórios de Marketing</div><div style={{ color: "#94a3b8", fontSize: 13 }}>Actividade da equipa de marketing</div></div>
          </div>
          <button onClick={exportCSV} style={{ display: "flex", alignItems: "center", gap: 7, background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.3)", color: "#a78bfa", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            <Download size={15} /> Exportar CSV
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
          {[
            { label: "Equipa Marketing", value: marketers.length, color: "#a78bfa" },
            { label: "Total visualizações", value: totalViews.toLocaleString("pt-PT"), color: "#38bdf8" },
            { label: "Total leads gerados", value: totalLeads, color: "#22c55e" },
          ].map(s => (
            <div key={s.label} style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 6 }}>{s.label}</div>
              <div style={{ color: s.color, fontSize: 22, fontWeight: 800 }}>{s.value}</div>
            </div>
          ))}
        </div>

        <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 12, padding: 16, marginBottom: 20, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <Filter size={16} color="#94a3b8" />
          <select value={filterUser} onChange={e => setFilterUser(e.target.value)} style={{ ...inp, minWidth: 160 }}>
            <option value="">Toda a equipa</option>
            {marketers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} style={inp} />
          {(filterUser || filterDate) && <button onClick={() => { setFilterUser(""); setFilterDate(""); }} style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", borderRadius: 8, padding: "7px 14px", fontSize: 13, cursor: "pointer" }}>Limpar</button>}
        </div>

        <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, padding: 20 }}>
          {loading ? <div style={{ color: "#94a3b8", textAlign: "center", padding: 40 }}>A carregar...</div>
          : reports.length === 0 ? <div style={{ color: "#94a3b8", textAlign: "center", padding: 40 }}>Nenhum relatório encontrado.</div>
          : reports.map(r => (
            <div key={r.id} style={{ borderBottom: "1px solid #1e2d50", paddingBottom: 14, marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#1e2d50", display: "flex", alignItems: "center", justifyContent: "center", color: "#a78bfa", fontWeight: 800, fontSize: 14, flexShrink: 0, overflow: "hidden" }}>
                    {r.user.avatar ? <img src={r.user.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : r.user.name[0]}
                  </div>
                  <div><div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>{r.user.name}</div><div style={{ color: "#94a3b8", fontSize: 12 }}>{r.user.email}</div></div>
                  <span style={{ background: r.date === today ? "rgba(167,139,250,0.15)" : "rgba(30,45,80,0.6)", color: r.date === today ? "#a78bfa" : "#94a3b8", border: `1px solid ${r.date === today ? "rgba(167,139,250,0.3)" : "#1e2d50"}`, borderRadius: 6, padding: "2px 10px", fontSize: 12, fontWeight: 700 }}>{r.date}</span>
                  {r.plataforma && <span style={{ color: "#94a3b8", fontSize: 12 }}>{r.plataforma}</span>}
                  {r.leadsGerados != null && <span style={{ color: "#22c55e", fontSize: 12, fontWeight: 700 }}>{r.leadsGerados} leads</span>}
                  {r.imagemProva && <span style={{ display: "flex", alignItems: "center", gap: 3, background: "rgba(56,189,248,0.1)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.3)", borderRadius: 6, padding: "2px 8px", fontSize: 11 }}><ImageIcon size={10} /> Prova</span>}
                </div>
                {expanded === r.id ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
              </div>
              {expanded === r.id && (
                <div style={{ marginTop: 14, background: "#0a0f1e", borderRadius: 10, padding: 16 }}>
                  {r.conteudoCriado && <p style={{ color: "#e2e8f0", fontSize: 13, margin: "0 0 8px" }}><span style={{ color: "#94a3b8" }}>Conteúdo: </span>{r.conteudoCriado}</p>}
                  {r.visualizacoes != null && <p style={{ color: "#e2e8f0", fontSize: 13, margin: "0 0 8px" }}><span style={{ color: "#94a3b8" }}>Visualizações: </span>{r.visualizacoes.toLocaleString("pt-PT")}</p>}
                  {r.observacoes && <p style={{ color: "#e2e8f0", fontSize: 13, margin: "0 0 8px" }}><span style={{ color: "#94a3b8" }}>Obs: </span>{r.observacoes}</p>}
                  {r.proximoConteudo && <p style={{ color: "#f5a623", fontSize: 13, margin: "0 0 8px" }}><span style={{ color: "#94a3b8" }}>Próximo: </span>{r.proximoConteudo}</p>}
                  {r.imagemProva && <img src={r.imagemProva} alt="prova" style={{ marginTop: 8, maxWidth: "100%", maxHeight: 250, borderRadius: 8, border: "1px solid #1e2d50", objectFit: "contain" }} />}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
