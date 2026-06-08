"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { CheckCircle, XCircle, Clock, Users, ChevronLeft, Award } from "lucide-react";

type TraderRow = {
  id: string;
  status: string;
  bio: string | null;
  commission: number;
  totalFollowers: number;
  totalCopied: number;
  createdAt: string;
  user: { id: string; name: string; email: string; avatar: string | null };
};

const CARD: React.CSSProperties = { background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, padding: 20 };

const STATUS_COLORS: Record<string, string> = {
  pending: "#f5a623",
  approved: "#22c55e",
  rejected: "#ef4444",
};
const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  approved: "Aprovado",
  rejected: "Rejeitado",
};

export default function AdminCopyPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [filter, setFilter] = useState("pending");
  const [traders, setTraders] = useState<TraderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [commission, setCommission] = useState<Record<string, string>>({});
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") { router.replace("/login"); return; }
    if (status !== "authenticated") return;
    if ((session?.user as any)?.role !== "admin") { router.replace("/trade"); return; }
    load();
  }, [status, filter]);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/copy/admin?status=${filter}`);
    if (res.ok) setTraders((await res.json()).traders ?? []);
    setLoading(false);
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  async function handleAction(traderId: string, action: "approve" | "reject") {
    setBusy(traderId);
    const comm = commission[traderId] ? parseFloat(commission[traderId]) / 100 : undefined;
    const res = await fetch("/api/copy/admin", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ traderId, action, ...(comm != null ? { commission: comm } : {}) }),
    });
    const data = await res.json();
    setBusy(null);
    if (!res.ok) { showToast(data.error ?? "Erro"); return; }
    showToast(action === "approve" ? "Expert aprovado!" : "Rejeitado.");
    load();
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1e", fontFamily: "system-ui,-apple-system,sans-serif", paddingBottom: 60 }}>
      {/* Topbar */}
      <div style={{ background: "#111827", borderBottom: "1px solid #1e2d50", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#94a3b8", display: "flex" }}>
          <ChevronLeft size={22} />
        </button>
        <Award size={20} color="#f5a623" />
        <span style={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>Copy Trading — Admin</span>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "20px 16px" }}>
        {/* Filtro */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {["pending", "approved", "rejected", "all"].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{
                flex: 1, padding: "9px 0", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13,
                background: filter === f ? "#f5a623" : "#111827",
                color: filter === f ? "#0a0f1e" : "#94a3b8",
              }}>
              {f === "all" ? "Todos" : STATUS_LABELS[f]}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#64748b" }}>A carregar...</div>
        ) : traders.length === 0 ? (
          <div style={{ ...CARD, textAlign: "center", padding: 40, color: "#64748b" }}>
            <Users size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
            <p style={{ margin: 0 }}>Sem candidaturas.</p>
          </div>
        ) : (
          traders.map(t => (
            <div key={t.id} style={{ ...CARD, marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
                {t.user.avatar ? (
                  <img src={t.user.avatar} alt={t.user.name} style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#1e2d50", display: "flex", alignItems: "center", justifyContent: "center", color: "#f5a623", fontWeight: 800, fontSize: 18, flexShrink: 0 }}>
                    {t.user.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2 }}>
                    <span style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>{t.user.name}</span>
                    <span style={{ background: STATUS_COLORS[t.status] + "22", color: STATUS_COLORS[t.status], fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>
                      {STATUS_LABELS[t.status] ?? t.status}
                    </span>
                  </div>
                  <div style={{ color: "#64748b", fontSize: 12 }}>{t.user.email}</div>
                  {t.bio && <p style={{ color: "#94a3b8", fontSize: 13, margin: "8px 0 0", lineHeight: 1.5 }}>{t.bio}</p>}
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, marginBottom: t.status === "pending" ? 14 : 0 }}>
                {[
                  { label: "Seguidores", value: t.totalFollowers },
                  { label: "Trades copiados", value: t.totalCopied },
                  { label: "Comissão actual", value: `${(t.commission * 100).toFixed(0)}%` },
                  { label: "Data candidatura", value: new Date(t.createdAt).toLocaleDateString("pt-PT") },
                ].map(s => (
                  <div key={s.label} style={{ flex: 1, background: "#0a0f1e", borderRadius: 8, padding: "10px 8px", textAlign: "center" }}>
                    <div style={{ color: "#f5a623", fontWeight: 800, fontSize: 15 }}>{s.value}</div>
                    <div style={{ color: "#64748b", fontSize: 10, marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {t.status === "pending" && (
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                    <span style={{ color: "#64748b", fontSize: 13, whiteSpace: "nowrap" }}>Comissão %:</span>
                    <input
                      type="number"
                      min={0} max={50} step={1}
                      placeholder="10"
                      value={commission[t.id] ?? ""}
                      onChange={e => setCommission(p => ({ ...p, [t.id]: e.target.value }))}
                      style={{ width: 70, background: "#0a0f1e", border: "1px solid #1e2d50", borderRadius: 8, padding: "8px 10px", color: "#fff", fontSize: 14, outline: "none" }}
                    />
                  </div>
                  <button onClick={() => handleAction(t.id, "approve")} disabled={busy === t.id}
                    style={{ flex: 1, background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.4)", borderRadius: 8, padding: "10px 0", color: "#22c55e", cursor: "pointer", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <CheckCircle size={15} /> {busy === t.id ? "..." : "Aprovar"}
                  </button>
                  <button onClick={() => handleAction(t.id, "reject")} disabled={busy === t.id}
                    style={{ flex: 1, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "10px 0", color: "#ef4444", cursor: "pointer", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <XCircle size={15} /> {busy === t.id ? "..." : "Rejeitar"}
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {toast && (
        <div style={{ position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)", background: "#1e2d50", border: "1px solid #334155", borderRadius: 10, padding: "12px 20px", color: "#fff", fontSize: 14, fontWeight: 600, zIndex: 9999, whiteSpace: "nowrap" }}>
          {toast}
        </div>
      )}
    </div>
  );
}
