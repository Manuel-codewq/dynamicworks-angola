"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { BookOpen, Filter, Video, TrendingUp, ChevronDown, ChevronUp, Users, Download, Image as ImageIcon, ExternalLink } from "lucide-react";

type Report = {
  id: string; date: string; feito: string; videoPublicado: boolean;
  videoTitulo: string | null; reacoes: number | null;
  duvidasMembros: string | null; planoAmanha: string | null;
  imagemProva: string | null; createdAt: string;
  user: { id: string; name: string; email: string; avatar: string | null };
};
type Formador = { id: string; name: string; email: string; avatar: string | null };

export default function AdminFormadoresPage() {
  const { data: session, status } = useSession();
  const router  = useRouter();
  const user    = session?.user as any;

  const [reports,    setReports]    = useState<Report[]>([]);
  const [formadores, setFormadores] = useState<Formador[]>([]);
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
    const params = new URLSearchParams();
    if (filterUser) params.set("userId", filterUser);
    if (filterDate) params.set("date", filterDate);
    setLoading(true);
    fetch(`/api/admin/formadores?${params}`)
      .then(r => r.json())
      .then(d => { setReports(d.reports || []); setFormadores(d.formadores || []); setLoading(false); });
  }, [status, filterUser, filterDate]);

  function buildCSVRows(rows: Report[]) {
    const header = ["Formador", "Email", "Data", "O que fez", "Vídeo publicado", "Título do vídeo", "Reacções", "Dúvidas dos membros", "Plano amanhã", "URL Prova"];
    const data   = rows.map(r => [
      r.user.name, r.user.email, r.date,
      `"${r.feito.replace(/"/g, '""')}"`,
      r.videoPublicado ? "Sim" : "Não",
      r.videoTitulo    ? `"${r.videoTitulo.replace(/"/g, '""')}"` : "",
      r.reacoes ?? "",
      r.duvidasMembros ? `"${r.duvidasMembros.replace(/"/g, '""')}"` : "",
      r.planoAmanha    ? `"${r.planoAmanha.replace(/"/g, '""')}"` : "",
      r.imagemProva    ? r.imagemProva : "",
    ]);
    return [header, ...data].map(r => r.join(",")).join("\n");
  }

  function downloadCSV(csvContent: string, filename: string) {
    const blob = new Blob(["﻿" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
  }

  function exportAll() {
    const nome    = filterUser ? (formadores.find(f => f.id === filterUser)?.name.replace(/\s+/g, "_") || "filtrado") : "todos";
    const data    = filterDate || new Date().toISOString().slice(0, 10);
    downloadCSV(buildCSVRows(reports), `formadores_${nome}_${data}.csv`);
  }

  function exportUser(userId: string, userName: string) {
    const userReports = reports.filter(r => r.user.id === userId);
    const nome        = userName.replace(/\s+/g, "_");
    downloadCSV(buildCSVRows(userReports), `formador_${nome}_${new Date().toISOString().slice(0, 10)}.csv`);
  }

  if (status === "loading") return null;

  const today         = new Date().toISOString().slice(0, 10);
  const totalVideos   = reports.filter(r => r.videoPublicado).length;
  const totalReacoes  = reports.reduce((s, r) => s + (r.reacoes || 0), 0);
  const reportHoje    = reports.filter(r => r.date === today).length;

  const inp: React.CSSProperties = {
    background: "#0a0f1e", border: "1px solid #1e2d50", borderRadius: 8,
    padding: "8px 12px", color: "#fff", fontSize: 13, outline: "none",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1e", fontFamily: "system-ui, sans-serif", padding: 24 }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <BookOpen size={28} color="#ffffff" />
            <div>
              <div style={{ color: "#fff", fontSize: 22, fontWeight: 800 }}>Relatórios dos Formadores</div>
              <div style={{ color: "#94a3b8", fontSize: 13 }}>Visão geral da equipa de formação</div>
            </div>
          </div>
          <button onClick={exportAll}
            style={{ display: "flex", alignItems: "center", gap: 7, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.3)", color: "#ffffff", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            <Download size={15} /> Exportar CSV {filterUser && `(${formadores.find(f => f.id === filterUser)?.name.split(" ")[0]})`}
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
          {[
            { icon: <Users size={18} color="#ffffff" />,      label: "Formadores",        value: formadores.length },
            { icon: <BookOpen size={18} color="#38bdf8" />,   label: "Relatórios hoje",   value: reportHoje },
            { icon: <Video size={18} color="#22c55e" />,       label: "Vídeos publicados", value: totalVideos },
            { icon: <TrendingUp size={18} color="#a78bfa" />,  label: "Reacções totais",   value: totalReacoes },
          ].map(s => (
            <div key={s.label} style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>{s.icon}<span style={{ color: "#94a3b8", fontSize: 12 }}>{s.label}</span></div>
              <div style={{ color: "#fff", fontSize: 22, fontWeight: 800 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 12, padding: 16, marginBottom: 20, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <Filter size={16} color="#94a3b8" />
          <select value={filterUser} onChange={e => setFilterUser(e.target.value)} style={{ ...inp, minWidth: 160 }}>
            <option value="">Todos os formadores</option>
            {formadores.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} style={inp} />
          {(filterUser || filterDate) && (
            <button onClick={() => { setFilterUser(""); setFilterDate(""); }}
              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", borderRadius: 8, padding: "7px 14px", fontSize: 13, cursor: "pointer" }}>
              Limpar filtros
            </button>
          )}
        </div>

        {/* Lista de relatórios */}
        <div style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, padding: 20 }}>
          {loading ? (
            <div style={{ color: "#94a3b8", textAlign: "center", padding: 40 }}>A carregar...</div>
          ) : reports.length === 0 ? (
            <div style={{ color: "#94a3b8", textAlign: "center", padding: 40 }}>Nenhum relatório encontrado.</div>
          ) : reports.map(r => (
            <div key={r.id} style={{ borderBottom: "1px solid #1e2d50", paddingBottom: 14, marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#1e2d50", display: "flex", alignItems: "center", justifyContent: "center", color: "#ffffff", fontWeight: 800, fontSize: 14, flexShrink: 0, overflow: "hidden" }}>
                    {r.user.avatar ? <img src={r.user.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : r.user.name[0]}
                  </div>
                  <div>
                    <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>{r.user.name}</div>
                    <div style={{ color: "#94a3b8", fontSize: 12 }}>{r.user.email}</div>
                  </div>
                  <span style={{ background: r.date === today ? "rgba(255,255,255,0.15)" : "rgba(30,45,80,0.6)", color: r.date === today ? "#ffffff" : "#94a3b8", border: `1px solid ${r.date === today ? "rgba(255,255,255,0.3)" : "#1e2d50"}`, borderRadius: 6, padding: "2px 10px", fontSize: 12, fontWeight: 700 }}>{r.date}</span>
                  {r.videoPublicado && (
                    <span style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 6, padding: "2px 8px", fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
                      <Video size={10} /> Vídeo publicado
                    </span>
                  )}
                  {r.reacoes != null && <span style={{ color: "#94a3b8", fontSize: 12 }}>{r.reacoes} reacções</span>}
                  {r.imagemProva && (
                    <span style={{ display: "flex", alignItems: "center", gap: 3, background: "rgba(56,189,248,0.1)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.3)", borderRadius: 6, padding: "2px 8px", fontSize: 11 }}>
                      <ImageIcon size={10} /> Prova
                    </span>
                  )}
                </div>
                {expanded === r.id ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
              </div>

              {expanded === r.id && (
                <div style={{ marginTop: 14, background: "#0a0f1e", borderRadius: 10, padding: 16 }}>
                  <div style={{ marginBottom: 10 }}>
                    <span style={{ color: "#94a3b8", fontSize: 12, display: "block", marginBottom: 3 }}>O que foi feito</span>
                    <p style={{ color: "#e2e8f0", fontSize: 14, margin: 0, lineHeight: 1.6 }}>{r.feito}</p>
                  </div>
                  {r.videoTitulo && (
                    <div style={{ marginBottom: 10 }}>
                      <span style={{ color: "#94a3b8", fontSize: 12, display: "block", marginBottom: 3 }}>Título do vídeo</span>
                      <p style={{ color: "#22c55e", fontSize: 14, margin: 0 }}>{r.videoTitulo}</p>
                    </div>
                  )}
                  {r.duvidasMembros && (
                    <div style={{ marginBottom: 10 }}>
                      <span style={{ color: "#94a3b8", fontSize: 12, display: "block", marginBottom: 3 }}>Dúvidas dos membros</span>
                      <p style={{ color: "#e2e8f0", fontSize: 14, margin: 0 }}>{r.duvidasMembros}</p>
                    </div>
                  )}
                  {r.planoAmanha && (
                    <div style={{ marginBottom: 10 }}>
                      <span style={{ color: "#94a3b8", fontSize: 12, display: "block", marginBottom: 3 }}>Plano para amanhã</span>
                      <p style={{ color: "#ffffff", fontSize: 14, margin: 0 }}>{r.planoAmanha}</p>
                    </div>
                  )}

                  {/* Prova */}
                  {r.imagemProva && (
                    <div style={{ marginBottom: 10 }}>
                      <span style={{ color: "#94a3b8", fontSize: 12, display: "block", marginBottom: 8 }}>Prova (print)</span>
                      <img src={r.imagemProva} alt="prova" style={{ maxWidth: "100%", maxHeight: 300, borderRadius: 10, border: "1px solid #1e2d50", objectFit: "contain", display: "block", marginBottom: 8 }} />
                      <a href={r.imagemProva} target="_blank" rel="noopener noreferrer"
                        style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "#38bdf8", fontSize: 13, textDecoration: "none", fontWeight: 600 }}>
                        <ExternalLink size={13} /> Abrir em tamanho real
                      </a>
                    </div>
                  )}

                  {/* Export individual */}
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #1e2d50" }}>
                    <button onClick={e => { e.stopPropagation(); exportUser(r.user.id, r.user.name); }}
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.3)", color: "#ffffff", borderRadius: 7, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                      <Download size={13} /> Exportar CSV de {r.user.name.split(" ")[0]}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
