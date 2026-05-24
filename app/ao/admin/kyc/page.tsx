"use client";
import { useEffect, useState } from "react";
import {
  RefreshCw, CheckCircle, XCircle, Eye, Shield,
  Clock, User, ShieldCheck, ShieldX, ScanFace,
} from "lucide-react";

interface KycEntry {
  id: string;
  userId: string;
  faceFront: string;
  faceRight: string;
  faceLeft: string;
  biFront: string;
  biBack: string;
  livenessScore: number;
  createdAt: string;
  user: {
    id: string; name: string; email: string; province: string | null;
    kycStatus: string; kycAttempts: number; kycBlockedUntil: string | null; createdAt: string;
  };
}

type Filter = "all" | "pending" | "approved" | "rejected";

const STATUS: Record<string, { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  pending:  { label: "Pendente",  color: "#f5a623", bg: "rgba(245,166,35,0.12)",  Icon: Clock },
  approved: { label: "Aprovado",  color: "#22c55e", bg: "rgba(34,197,94,0.12)",   Icon: ShieldCheck },
  rejected: { label: "Rejeitado", color: "#ef4444", bg: "rgba(239,68,68,0.12)",   Icon: ShieldX },
};

function LivenessBadge({ score }: { score: number }) {
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#f5a623" : "#ef4444";
  const bg    = score >= 80 ? "rgba(34,197,94,0.12)" : score >= 60 ? "rgba(245,166,35,0.12)" : "rgba(239,68,68,0.12)";
  return (
    <span style={{ background: bg, color, borderRadius: 20, padding: "2px 8px", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
      {score}% IA
    </span>
  );
}

// Reduz imagem Cloudinary para thumbnail 80×80 — evita carregar imagens de alta resolução na tabela
function cloudThumb(url: string, size = 80): string {
  if (!url?.includes("cloudinary.com")) return url;
  return url.replace("/upload/", `/upload/w_${size},h_${size},c_fill,q_auto,f_auto/`);
}

export default function AdminKycPage() {
  const [entries,  setEntries]  = useState<KycEntry[]>([]);
  const [counts,   setCounts]   = useState({ all: 0, pending: 0, approved: 0, rejected: 0 });
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState<Filter>("pending");
  const [selected, setSelected] = useState<KycEntry | null>(null);
  const [busyId,   setBusyId]   = useState<string | null>(null);
  const [imgZoom,  setImgZoom]  = useState<string | null>(null);

  async function load(f: Filter = filter) {
    setLoading(true);
    const param = f === "all" ? "" : `?status=${f}`;
    const res = await fetch(`/api/admin/kyc${param}`);
    if (res.ok) {
      const data = await res.json();
      setEntries(data.entries ?? []);
      setCounts(data.counts ?? { all: 0, pending: 0, approved: 0, rejected: 0 });
    }
    setLoading(false);
  }
  useEffect(() => { load("pending"); }, []);

  async function decide(userId: string, status: "approved" | "rejected") {
    setBusyId(userId);
    await fetch(`/api/admin/users/${userId}/kyc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setBusyId(null);
    setSelected(null);
    load(filter);
  }

  async function resetAttempts(userId: string) {
    setBusyId(userId);
    await fetch(`/api/admin/kyc/${userId}`, { method: "DELETE" });
    setBusyId(null);
    load(filter);
  }

  function changeFilter(f: Filter) {
    setFilter(f);
    load(f);
  }

  const visible = entries; // filtragem feita no servidor

  const card  = (extra?: React.CSSProperties): React.CSSProperties => ({ background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, ...extra });
  const th: React.CSSProperties = { color: "#64748b", fontSize: 11, padding: "10px 14px", textAlign: "left", borderBottom: "1px solid #1e2d50", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px", whiteSpace: "nowrap" };
  const td: React.CSSProperties = { padding: "12px 14px", borderBottom: "1px solid rgba(30,45,80,0.35)", fontSize: 13, verticalAlign: "middle" };

  return (
    <div style={{ padding: 28, maxWidth: 1300 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 800, margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
            <ScanFace size={24} color="#f5a623" /> Verificação KYC
          </h1>
          <p style={{ color: "#64748b", fontSize: 13, margin: "4px 0 0" }}>Reveja e decida sobre as submissões de identidade</p>
        </div>
        <button onClick={() => load(filter)} style={{ display: "flex", alignItems: "center", gap: 6, background: "#1e2d50", border: "none", borderRadius: 8, padding: "8px 14px", color: "#94a3b8", cursor: "pointer", fontSize: 13 }}>
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
        {(["all", "pending", "approved", "rejected"] as Filter[]).map(f => {
          const active = filter === f;
          const colors: Record<Filter, string> = { all: "#94a3b8", pending: "#f5a623", approved: "#22c55e", rejected: "#ef4444" };
          const c = colors[f];
          return (
            <button key={f} onClick={() => changeFilter(f)}
              style={{ ...card({ padding: "16px 20px", cursor: "pointer", border: active ? `1px solid ${c}` : "1px solid #1e2d50", background: active ? `${c}18` : "#111827", textAlign: "left" }) }}>
              <div style={{ color: "#64748b", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 6 }}>
                {f === "all" ? "Total" : STATUS[f].label}
              </div>
              <div style={{ color: active ? c : "#fff", fontSize: 28, fontWeight: 800 }}>{counts[f]}</div>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div style={card({ overflow: "hidden" })}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>A carregar...</div>
        ) : visible.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center" }}>
            <Shield size={36} style={{ color: "#1e2d50", marginBottom: 12 }} />
            <p style={{ color: "#64748b", fontSize: 14 }}>Nenhuma submissão {filter !== "all" ? `com estado "${STATUS[filter]?.label}"` : ""}.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 800 }}>
              <thead>
                <tr>
                  {["Utilizador", "Email", "Data submissão", "Tentativas", "Liveness", "Estado", "Ações"].map(h => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map(entry => {
                  const st = STATUS[entry.user.kycStatus] ?? STATUS.pending;
                  const busy = busyId === entry.userId;
                  return (
                    <tr key={entry.id} style={{ opacity: busy ? 0.5 : 1, transition: "opacity .2s" }}>

                      <td style={{ ...td, color: "#fff", fontWeight: 600 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 34, height: 34, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: "#1e2d50", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <img src={cloudThumb(entry.faceFront, 80)} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          </div>
                          {entry.user.name}
                        </div>
                      </td>

                      <td style={{ ...td, color: "#64748b" }}>{entry.user.email}</td>

                      <td style={{ ...td, color: "#64748b" }}>
                        {new Date(entry.createdAt).toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </td>

                      <td style={{ ...td, color: entry.user.kycAttempts >= 2 ? "#ef4444" : "#94a3b8", fontWeight: 700 }}>
                        {entry.user.kycAttempts} / 2
                      </td>

                      <td style={td}><LivenessBadge score={entry.livenessScore} /></td>

                      <td style={td}>
                        <span style={{ background: st.bg, color: st.color, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 5 }}>
                          <st.Icon size={11} /> {st.label}
                        </span>
                      </td>

                      <td style={td}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => setSelected(entry)} disabled={busy}
                            style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(245,166,35,0.1)", color: "#f5a623", border: "1px solid rgba(245,166,35,0.25)", borderRadius: 7, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                            <Eye size={13} /> Ver
                          </button>
                          {entry.user.kycStatus === "pending" && (
                            <>
                              <button onClick={() => decide(entry.userId, "approved")} disabled={busy}
                                style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(34,197,94,0.1)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 7, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                                <CheckCircle size={13} /> Aprovar
                              </button>
                              <button onClick={() => decide(entry.userId, "rejected")} disabled={busy}
                                style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 7, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                                <XCircle size={13} /> Rejeitar
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selected && (
        <div onClick={() => setSelected(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#111827", border: "1px solid #1e2d50", borderRadius: 20, width: "100%", maxWidth: 820, maxHeight: "92vh", overflowY: "auto", padding: 28 }}>

            {/* Modal header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <h2 style={{ color: "#fff", margin: 0, fontSize: 18, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                  <User size={18} color="#f5a623" /> {selected.user.name}
                </h2>
                <p style={{ color: "#64748b", fontSize: 13, margin: "4px 0 0" }}>{selected.user.email} · {selected.user.province ?? "Província não indicada"}</p>
              </div>
              <button onClick={() => setSelected(null)} style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer", padding: 4 }}><XCircle size={22} /></button>
            </div>

            {/* Liveness + stats */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
              {[
                { label: "Liveness IA", value: `${selected.livenessScore}%`, color: selected.livenessScore >= 80 ? "#22c55e" : selected.livenessScore >= 60 ? "#f5a623" : "#ef4444" },
                { label: "Tentativas", value: `${selected.user.kycAttempts} / 2`, color: selected.user.kycAttempts >= 2 ? "#ef4444" : "#94a3b8" },
                { label: "Estado", value: STATUS[selected.user.kycStatus]?.label ?? selected.user.kycStatus, color: STATUS[selected.user.kycStatus]?.color ?? "#94a3b8" },
              ].map(s => (
                <div key={s.label} style={{ background: "#0a0f1e", borderRadius: 10, padding: "12px 16px", border: "1px solid #1e2d50" }}>
                  <div style={{ color: "#64748b", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 4 }}>{s.label}</div>
                  <div style={{ color: s.color, fontSize: 20, fontWeight: 800 }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Photos grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 12 }}>
              {[
                { label: "Rosto — Frente", img: selected.faceFront },
                { label: "Rosto — Direita", img: selected.faceRight },
                { label: "Rosto — Esquerda", img: selected.faceLeft },
              ].map(item => (
                <div key={item.label} onClick={() => setImgZoom(item.img)} style={{ background: "#0a0f1e", borderRadius: 10, overflow: "hidden", border: "1px solid #1e2d50", cursor: "zoom-in" }}>
                  <div style={{ color: "#64748b", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px", padding: "6px 10px" }}>{item.label}</div>
                  <img src={item.img} alt={item.label} style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", display: "block" }} />
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
              {[
                { label: "B.I. — Frente", img: selected.biFront },
                { label: "B.I. — Verso",  img: selected.biBack  },
              ].map(item => (
                <div key={item.label} onClick={() => setImgZoom(item.img)} style={{ background: "#0a0f1e", borderRadius: 10, overflow: "hidden", border: "1px solid #1e2d50", cursor: "zoom-in" }}>
                  <div style={{ color: "#64748b", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".5px", padding: "6px 10px" }}>{item.label}</div>
                  <img src={item.img} alt={item.label} style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", display: "block" }} />
                </div>
              ))}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {selected.user.kycStatus === "pending" ? (
                <div style={{ display: "flex", gap: 12 }}>
                  <button onClick={() => decide(selected.userId, "approved")} disabled={!!busyId}
                    style={{ flex: 1, background: "#22c55e", color: "#fff", border: "none", borderRadius: 10, padding: "14px 0", fontWeight: 700, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <CheckCircle size={18} /> Aprovar Identidade
                  </button>
                  <button onClick={() => decide(selected.userId, "rejected")} disabled={!!busyId}
                    style={{ flex: 1, background: "#ef4444", color: "#fff", border: "none", borderRadius: 10, padding: "14px 0", fontWeight: 700, fontSize: 15, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <XCircle size={18} /> Rejeitar Documentos
                  </button>
                </div>
              ) : (
                (() => {
                  const st = STATUS[selected.user.kycStatus];
                  const StIcon = st?.Icon;
                  return (
                    <div style={{ background: st?.bg, border: `1px solid ${st?.color ?? "#64748b"}30`, borderRadius: 10, padding: "14px 18px", display: "flex", alignItems: "center", gap: 10 }}>
                      {StIcon && <StIcon size={18} color={st.color} />}
                      <span style={{ color: st?.color, fontWeight: 700 }}>
                        KYC já {selected.user.kycStatus === "approved" ? "aprovado" : "rejeitado"}
                      </span>
                    </div>
                  );
                })()
              )}
              {/* Botão reset de tentativas — sempre visível para admin desbloquear utilizador */}
              {(selected.user.kycAttempts > 0 || selected.user.kycBlockedUntil) && (
                <button onClick={() => resetAttempts(selected.userId)} disabled={!!busyId}
                  style={{ width: "100%", background: "transparent", color: "#f5a623", border: "1px solid rgba(245,166,35,0.3)", borderRadius: 10, padding: "11px 0", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <RefreshCw size={15} /> Resetar Tentativas ({selected.user.kycAttempts}/4 usadas)
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Image zoom */}
      {imgZoom && (
        <div onClick={() => setImgZoom(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.95)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, cursor: "zoom-out", padding: 20 }}>
          <img src={imgZoom} alt="zoom" style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 12, objectFit: "contain" }} />
        </div>
      )}
    </div>
  );
}
