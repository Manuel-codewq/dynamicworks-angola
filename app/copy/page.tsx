"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
import { Users, TrendingUp, Copy, CheckCircle, XCircle, Plus, Minus, ChevronLeft, Award, AlertCircle } from "lucide-react";

type Expert = {
  id: string;
  userId: string;
  name: string;
  avatar: string | null;
  bio: string | null;
  commission: number;
  totalFollowers: number;
  totalCopied: number;
  following: { active: boolean; amount: number } | null;
};

type MyProfile = { traderProfile: any; follows: any[] };

const CARD: React.CSSProperties = {
  background: "#111827",
  border: "1px solid #1e2d50",
  borderRadius: 14,
  padding: 20,
};

export default function CopyTradingPage() {
  const { status } = useSession();
  const router = useRouter();
  const t = useT();

  const [experts, setExperts] = useState<Expert[]>([]);
  const [myProfile, setMyProfile] = useState<MyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [followAmount, setFollowAmount] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [applyBio, setApplyBio] = useState("");
  const [applyBusy, setApplyBusy] = useState(false);
  const [applyError, setApplyError] = useState("");
  const [applyDone, setApplyDone] = useState(false);
  const [toast, setToast] = useState("");
  const [tab, setTab] = useState<"experts" | "my">("experts");

  useEffect(() => {
    if (status === "unauthenticated") { router.replace("/login"); return; }
    if (status !== "authenticated") return;
    loadAll();
  }, [status]);

  async function loadAll() {
    setLoading(true);
    const [expRes, myRes] = await Promise.all([
      fetch("/api/copy/experts"),
      fetch("/api/copy/my"),
    ]);
    if (expRes.ok) setExperts((await expRes.json()).experts ?? []);
    if (myRes.ok) setMyProfile(await myRes.json());
    setLoading(false);
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  async function handleFollow(expert: Expert) {
    const amt = Number(followAmount[expert.id] ?? "1000");
    if (!amt || amt < 1000) { showToast(t("copy.minAmount")); return; }
    setBusy(expert.id);
    const res = await fetch("/api/copy/follow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ traderId: expert.id, amount: amt }),
    });
    const data = await res.json();
    setBusy(null);
    if (!res.ok) { showToast(data.error ?? t("common.error")); return; }
    showToast(`${t("copy.startedCopying")} ${expert.name}!`);
    loadAll();
  }

  async function handleUnfollow(expert: Expert) {
    setBusy(expert.id);
    const res = await fetch(`/api/copy/follow?traderId=${expert.id}`, { method: "DELETE" });
    setBusy(null);
    if (!res.ok) { showToast(t("common.error")); return; }
    showToast(t("copy.stopped"));
    loadAll();
  }

  async function handleApply() {
    setApplyBusy(true);
    setApplyError("");
    const res = await fetch("/api/copy/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bio: applyBio }),
    });
    const data = await res.json();
    setApplyBusy(false);
    if (!res.ok) { setApplyError(data.error ?? t("common.error")); return; }
    setApplyDone(true);
    loadAll();
  }

  const statusMap: Record<string, { label: string; color: string }> = {
    pending:  { label: t("copy.status.pending"),  color: "#f5a623" },
    approved: { label: t("copy.status.approved"), color: "#22c55e" },
    rejected: { label: t("copy.status.rejected"), color: "#ef4444" },
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0f1e", fontFamily: "system-ui,-apple-system,sans-serif", paddingBottom: 100 }}>
      {/* Topbar */}
      <div style={{ background: "#111827", borderBottom: "1px solid #1e2d50", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#94a3b8", display: "flex" }}>
          <ChevronLeft size={22} />
        </button>
        <img src="/logo-icon.jpeg" alt="Dynamic Works" style={{ height: 28, width: 28, objectFit: "contain", borderRadius: 6, background: "#1e2d50" }} />
        <span style={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>Copy Trading</span>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "20px 16px" }}>
        {/* Hero */}
        <div style={{ ...CARD, background: "linear-gradient(135deg,#1a2544 0%,#0f1c38 100%)", marginBottom: 20, textAlign: "center", padding: "28px 20px" }}>
          <Copy size={36} color="#f5a623" style={{ marginBottom: 10 }} />
          <h1 style={{ color: "#fff", fontSize: 20, fontWeight: 800, margin: "0 0 8px" }}>Copy Trading</h1>
          <p style={{ color: "#94a3b8", fontSize: 14, margin: "0 0 14px", lineHeight: 1.6 }}>
            {t("copy.heroDesc")}
          </p>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.3)", borderRadius: 8, padding: "8px 14px" }}>
            <span style={{ fontSize: 13, color: "#f5a623", fontWeight: 700 }}>{t("copy.realOnly")}</span>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {(["experts", "my"] as const).map(tabKey => (
            <button key={tabKey} onClick={() => setTab(tabKey)}
              style={{
                flex: 1, padding: "10px 0", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 14,
                background: tab === tabKey ? "#f5a623" : "#111827",
                color: tab === tabKey ? "#0a0f1e" : "#94a3b8",
              }}>
              {tabKey === "experts" ? t("copy.tab.experts") : t("copy.tab.myFollows")}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#64748b" }}>{t("common.loading")}</div>
        ) : tab === "experts" ? (
          <>
            {experts.length === 0 ? (
              <div style={{ ...CARD, textAlign: "center", padding: 40, color: "#64748b" }}>
                <Users size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
                <p style={{ margin: 0 }}>{t("copy.noExperts")}</p>
              </div>
            ) : (
              experts.map(expert => {
                const isFollowing = expert.following?.active;
                return (
                  <div key={expert.id} style={{ ...CARD, marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
                      {expert.avatar ? (
                        <img src={expert.avatar} alt={expert.name} style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#1e2d50", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 18, color: "#f5a623", fontWeight: 800 }}>
                          {expert.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>{expert.name}</span>
                          <Award size={14} color="#f5a623" />
                        </div>
                        {expert.bio && <p style={{ color: "#94a3b8", fontSize: 13, margin: "4px 0 0", lineHeight: 1.5 }}>{expert.bio}</p>}
                      </div>
                    </div>

                    {/* Estatísticas */}
                    <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                      {[
                        { label: t("copy.followers"),   value: expert.totalFollowers },
                        { label: t("copy.copied"),      value: expert.totalCopied },
                        { label: t("copy.commission"),  value: `${(expert.commission * 100).toFixed(0)}%` },
                      ].map(s => (
                        <div key={s.label} style={{ flex: 1, background: "#0a0f1e", borderRadius: 8, padding: "10px 8px", textAlign: "center" }}>
                          <div style={{ color: "#f5a623", fontWeight: 800, fontSize: 16 }}>{s.value}</div>
                          <div style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>{s.label}</div>
                        </div>
                      ))}
                    </div>

                    {isFollowing ? (
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <div style={{ flex: 1, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
                          <CheckCircle size={16} color="#22c55e" />
                          <span style={{ color: "#22c55e", fontSize: 13, fontWeight: 700 }}>{t("copy.copying")} · {(expert.following!.amount).toLocaleString("pt-PT")} Kz/trade</span>
                        </div>
                        <button onClick={() => handleUnfollow(expert)} disabled={busy === expert.id}
                          style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "10px 14px", color: "#ef4444", cursor: "pointer", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>
                          {busy === expert.id ? "..." : t("copy.stop")}
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 10 }}>
                        <input
                          type="number"
                          placeholder={t("copy.kzPerTrade")}
                          value={followAmount[expert.id] ?? "1000"}
                          onChange={e => setFollowAmount(p => ({ ...p, [expert.id]: e.target.value }))}
                          style={{ flex: 1, background: "#0a0f1e", border: "1px solid #1e2d50", borderRadius: 8, padding: "10px 12px", color: "#fff", fontSize: 14, outline: "none" }}
                        />
                        <button onClick={() => handleFollow(expert)} disabled={busy === expert.id}
                          style={{ background: "#f5a623", border: "none", borderRadius: 8, padding: "10px 18px", color: "#0a0f1e", cursor: "pointer", fontWeight: 700, fontSize: 14, whiteSpace: "nowrap" }}>
                          {busy === expert.id ? "..." : t("copy.copyBtn")}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </>
        ) : (
          /* My Follows tab */
          <>
            {/* Expert application */}
            <div style={{ ...CARD, marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <TrendingUp size={18} color="#f5a623" />
                <span style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>{t("copy.applyTitle")}</span>
              </div>
              {myProfile?.traderProfile ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: statusMap[myProfile.traderProfile.status]?.color ?? "#94a3b8" }} />
                  <span style={{ color: statusMap[myProfile.traderProfile.status]?.color ?? "#94a3b8", fontSize: 14, fontWeight: 700 }}>
                    {statusMap[myProfile.traderProfile.status]?.label ?? myProfile.traderProfile.status}
                  </span>
                  {myProfile.traderProfile.status === "approved" && (
                    <span style={{ color: "#64748b", fontSize: 13, marginLeft: 4 }}>
                      · {myProfile.traderProfile.totalFollowers} {t("copy.followersStats")} · {myProfile.traderProfile.totalCopied} trades
                    </span>
                  )}
                </div>
              ) : applyDone ? (
                <div style={{ color: "#22c55e", fontSize: 14 }}>{t("copy.applied")}</div>
              ) : (
                <>
                  <p style={{ color: "#94a3b8", fontSize: 13, margin: "0 0 14px", lineHeight: 1.5 }}>
                    {t("copy.applyDesc")}
                  </p>
                  <textarea
                    placeholder={t("copy.bioPlaceholder")}
                    value={applyBio}
                    onChange={e => setApplyBio(e.target.value)}
                    rows={3}
                    style={{ width: "100%", background: "#0a0f1e", border: "1px solid #1e2d50", borderRadius: 8, padding: "10px 12px", color: "#fff", fontSize: 14, outline: "none", resize: "vertical", boxSizing: "border-box", marginBottom: 10 }}
                  />
                  {applyError && (
                    <div style={{ color: "#ef4444", fontSize: 13, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                      <AlertCircle size={14} />{applyError}
                    </div>
                  )}
                  <button onClick={handleApply} disabled={applyBusy}
                    style={{ width: "100%", background: applyBusy ? "#1e2d50" : "#f5a623", color: applyBusy ? "#64748b" : "#0a0f1e", border: "none", borderRadius: 8, padding: "10px 0", fontWeight: 700, fontSize: 14, cursor: applyBusy ? "not-allowed" : "pointer" }}>
                    {applyBusy ? t("copy.sending") : t("copy.applyBtn")}
                  </button>
                </>
              )}
            </div>

            {/* Follows list */}
            <div style={{ color: "#94a3b8", fontSize: 13, marginBottom: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
              {t("copy.following")} ({myProfile?.follows?.length ?? 0})
            </div>
            {(!myProfile?.follows?.length) ? (
              <div style={{ ...CARD, textAlign: "center", padding: 32, color: "#64748b" }}>
                <Copy size={28} style={{ marginBottom: 10, opacity: 0.4 }} />
                <p style={{ margin: 0 }}>{t("copy.noFollows")}</p>
              </div>
            ) : (
              myProfile.follows.map((f: any) => (
                <div key={f.id} style={{ ...CARD, marginBottom: 12, display: "flex", alignItems: "center", gap: 14 }}>
                  {f.trader.user.avatar ? (
                    <img src={f.trader.user.avatar} alt={f.trader.user.name} style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#1e2d50", display: "flex", alignItems: "center", justifyContent: "center", color: "#f5a623", fontWeight: 800, fontSize: 16 }}>
                      {f.trader.user.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>{f.trader.user.name}</div>
                    <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>{f.amount.toLocaleString("pt-PT")} {t("copy.kzPerTrade")}</div>
                  </div>
                  <button onClick={() => handleUnfollow({ ...f.trader, id: f.traderId, following: f } as any)} disabled={busy === f.traderId}
                    style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "8px 12px", color: "#ef4444", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
                    {busy === f.traderId ? "..." : t("copy.stop")}
                  </button>
                </div>
              ))
            )}
          </>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)", background: "#1e2d50", border: "1px solid #334155", borderRadius: 10, padding: "12px 20px", color: "#fff", fontSize: 14, fontWeight: 600, zIndex: 9999, whiteSpace: "nowrap" }}>
          {toast}
        </div>
      )}
    </div>
  );
}
