"use client";
import { useEffect, useRef, useState } from "react";
import { Bell, X, CheckCircle, XCircle, Wallet, ArrowUpCircle, ScanFace, Megaphone, Info, TrendingUp, TrendingDown, Gift } from "lucide-react";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; bg: string }> = {
  trade_win:            { icon: <TrendingUp  size={18} color="#22c55e" />, bg: "rgba(34,197,94,0.12)"  },
  trade_loss:           { icon: <TrendingDown size={18} color="#ef4444" />, bg: "rgba(239,68,68,0.12)" },
  deposit_completed:    { icon: <CheckCircle  size={18} color="#22c55e" />, bg: "rgba(34,197,94,0.12)"  },
  deposit_rejected:     { icon: <XCircle      size={18} color="#ef4444" />, bg: "rgba(239,68,68,0.12)" },
  withdrawal_completed: { icon: <ArrowUpCircle size={18} color="#22c55e" />, bg: "rgba(34,197,94,0.12)" },
  withdrawal_rejected:  { icon: <XCircle      size={18} color="#ef4444" />, bg: "rgba(239,68,68,0.12)" },
  kyc_approved:         { icon: <ScanFace     size={18} color="#22c55e" />, bg: "rgba(34,197,94,0.12)"  },
  kyc_rejected:         { icon: <ScanFace     size={18} color="#ef4444" />, bg: "rgba(239,68,68,0.12)" },
  broadcast:            { icon: <Megaphone    size={18} color="#f5a623" />, bg: "rgba(245,166,35,0.12)" },
  admin:                { icon: <Info         size={18} color="#38bdf8" />, bg: "rgba(56,189,248,0.12)" },
  referral_commission:  { icon: <Gift         size={18} color="#22c55e" />, bg: "rgba(34,197,94,0.12)"  },
};

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60)    return "agora mesmo";
  if (diff < 3600)  return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  return `há ${Math.floor(diff / 86400)} d`;
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open,       setOpen]       = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [isMobile,   setIsMobile]   = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const unread = notifications.filter(n => !n.read).length;

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  async function load() {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) setNotifications(await res.json());
    } catch {}
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  // Close dropdown on outside click (desktop only)
  useEffect(() => {
    if (isMobile) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isMobile]);

  // Prevent body scroll when bottom sheet is open
  useEffect(() => {
    if (isMobile && open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isMobile, open]);

  async function markRead(id: string) {
    setNotifications(n => n.map(x => x.id === id ? { ...x, read: true } : x));
    try { await fetch(`/api/notifications/${id}/read`, { method: "PATCH" }); } catch {}
  }

  async function markAll() {
    setMarkingAll(true);
    const unreadOnes = notifications.filter(n => !n.read);
    setNotifications(n => n.map(x => ({ ...x, read: true })));
    await Promise.allSettled(
      unreadOnes.map(n => fetch(`/api/notifications/${n.id}/read`, { method: "PATCH" }))
    );
    setMarkingAll(false);
  }

  const NotifList = () => (
    <>
      {notifications.length === 0 ? (
        <div style={{ padding: "32px 16px", textAlign: "center", color: "#475569", fontSize: 13, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <Bell size={32} color="#1e2d50" />
          Sem notificações
        </div>
      ) : (
        notifications.slice(0, 15).map(n => (
          <div key={n.id} onClick={() => !n.read && markRead(n.id)}
            style={{
              display: "flex", gap: 12, padding: "14px 16px",
              borderBottom: "1px solid rgba(30,45,80,0.5)",
              background: n.read ? "transparent" : "rgba(245,166,35,0.05)",
              cursor: n.read ? "default" : "pointer",
            }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: TYPE_CONFIG[n.type]?.bg ?? "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {TYPE_CONFIG[n.type]?.icon ?? <Bell size={18} color="#94a3b8" />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                <span style={{ color: n.read ? "#94a3b8" : "#fff", fontWeight: n.read ? 400 : 700, fontSize: 14 }}>
                  {n.title}
                </span>
                {!n.read && (
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#f5a623", flexShrink: 0 }} />
                )}
              </div>
              <div style={{ color: "#64748b", fontSize: 13, lineHeight: 1.5 }}>{n.message}</div>
              <div style={{ color: "#475569", fontSize: 11, marginTop: 5 }}>{timeAgo(n.createdAt)}</div>
            </div>
          </div>
        ))
      )}
    </>
  );

  return (
    <>
      {/* Bell button */}
      <div ref={ref} style={{ position: "relative" }}>
        <button onClick={() => setOpen(o => !o)}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 4, position: "relative", display: "flex", alignItems: "center", color: "#94a3b8" }}>
          <Bell size={18} />
          {unread > 0 && (
            <span style={{
              position: "absolute", top: 0, right: 0, background: "#ef4444", color: "#fff",
              borderRadius: "50%", fontSize: 9, fontWeight: 800, minWidth: 14, height: 14,
              display: "flex", alignItems: "center", justifyContent: "center", padding: "0 2px",
            }}>
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>

        {/* Desktop dropdown */}
        {!isMobile && open && (
          <div style={{
            position: "absolute", top: "calc(100% + 8px)", right: 0, width: 320,
            background: "#111827", border: "1px solid #1e2d50", borderRadius: 12,
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)", zIndex: 1000, overflow: "hidden",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid #1e2d50" }}>
              <span style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>Notificações</span>
              {unread > 0 && (
                <button onClick={markAll} disabled={markingAll}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#f5a623", fontSize: 11, fontWeight: 600 }}>
                  Marcar todas como lidas
                </button>
              )}
            </div>
            <div style={{ maxHeight: 380, overflowY: "auto" }}>
              <NotifList />
            </div>
          </div>
        )}
      </div>

      {/* Mobile bottom sheet */}
      {isMobile && (
        <>
          {/* Backdrop */}
          {open && (
            <div onClick={() => setOpen(false)}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 500 }} />
          )}

          {/* Sheet */}
          <div style={{
            position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 600,
            background: "#111827", borderRadius: "16px 16px 0 0",
            boxShadow: "0 -8px 40px rgba(0,0,0,0.6)",
            transform: open ? "translateY(0)" : "translateY(100%)",
            transition: "transform 0.3s cubic-bezier(0.32,0.72,0,1)",
            maxHeight: "80vh", display: "flex", flexDirection: "column",
          }}>
            {/* Handle */}
            <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 0" }}>
              <div style={{ width: 36, height: 4, background: "#374151", borderRadius: 2 }} />
            </div>

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid #1e2d50" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>Notificações</span>
                {unread > 0 && (
                  <span style={{ background: "#ef4444", color: "#fff", borderRadius: 10, fontSize: 11, fontWeight: 700, padding: "1px 7px" }}>
                    {unread}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {unread > 0 && (
                  <button onClick={markAll} disabled={markingAll}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#f5a623", fontSize: 12, fontWeight: 600 }}>
                    Ler todas
                  </button>
                )}
                <button onClick={() => setOpen(false)}
                  style={{ background: "#1e2d50", border: "none", borderRadius: 8, width: 30, height: 30, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <X size={14} color="#94a3b8" />
                </button>
              </div>
            </div>

            {/* List */}
            <div style={{ overflowY: "auto", flex: 1, paddingBottom: 24 }}>
              <NotifList />
            </div>
          </div>
        </>
      )}
    </>
  );
}
