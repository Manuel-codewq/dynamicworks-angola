"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, X, CheckCircle, XCircle, Wallet, ArrowUpCircle, ScanFace, Megaphone, Info, TrendingUp, TrendingDown, Gift, ChevronRight, MessageCircle, ExternalLink } from "lucide-react";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; bg: string; color: string }> = {
  trade_win:            { icon: <TrendingUp   size={20} color="#22c55e" />, bg: "rgba(34,197,94,0.12)",   color: "#22c55e" },
  trade_loss:           { icon: <TrendingDown size={20} color="#ef4444" />, bg: "rgba(239,68,68,0.12)",   color: "#ef4444" },
  deposit_completed:    { icon: <CheckCircle  size={20} color="#22c55e" />, bg: "rgba(34,197,94,0.12)",   color: "#22c55e" },
  deposit_rejected:     { icon: <XCircle      size={20} color="#ef4444" />, bg: "rgba(239,68,68,0.12)",   color: "#ef4444" },
  withdrawal_completed: { icon: <ArrowUpCircle size={20} color="#22c55e" />, bg: "rgba(34,197,94,0.12)", color: "#22c55e" },
  withdrawal_rejected:  { icon: <XCircle      size={20} color="#ef4444" />, bg: "rgba(239,68,68,0.12)",   color: "#ef4444" },
  kyc_approved:         { icon: <ScanFace     size={20} color="#22c55e" />, bg: "rgba(34,197,94,0.12)",   color: "#22c55e" },
  kyc_rejected:         { icon: <ScanFace     size={20} color="#ef4444" />, bg: "rgba(239,68,68,0.12)",   color: "#ef4444" },
  broadcast:            { icon: <Megaphone    size={20} color="#f5a623" />, bg: "rgba(245,166,35,0.12)",  color: "#f5a623" },
  admin:                { icon: <Info         size={20} color="#38bdf8" />, bg: "rgba(56,189,248,0.12)",  color: "#38bdf8" },
  referral_commission:  { icon: <Gift          size={20} color="#22c55e" />, bg: "rgba(34,197,94,0.12)",   color: "#22c55e" },
  info:                 { icon: <Info          size={20} color="#f5a623" />, bg: "rgba(245,166,35,0.12)",  color: "#f5a623" },
  whatsapp_invite:      { icon: <MessageCircle size={20} color="#25d366" />, bg: "rgba(37,211,102,0.12)",  color: "#25d366" },
};

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60)    return "agora mesmo";
  if (diff < 3600)  return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  if (diff < 86400 * 7) return `há ${Math.floor(diff / 86400)} d`;
  return new Date(dateStr).toLocaleDateString("pt-PT", { day: "2-digit", month: "short" });
}

function isLong(n: Notification) {
  return n.message.length > 120 || n.message.includes("\n");
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open,          setOpen]          = useState(false);
  const [markingAll,    setMarkingAll]    = useState(false);
  const [isMobile,      setIsMobile]      = useState(false);
  const [selected,      setSelected]      = useState<Notification | null>(null);
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

  useEffect(() => {
    if (isMobile) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isMobile]);

  useEffect(() => {
    document.body.style.overflow = (isMobile && open) || selected ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isMobile, open, selected]);

  async function markRead(id: string) {
    setNotifications(n => n.map(x => x.id === id ? { ...x, read: true } : x));
    try { await fetch(`/api/notifications/${id}/read`, { method: "PATCH" }); } catch {}
  }

  async function markAll() {
    setMarkingAll(true);
    const unreadOnes = notifications.filter(n => !n.read);
    setNotifications(n => n.map(x => ({ ...x, read: true })));
    await Promise.allSettled(unreadOnes.map(n => fetch(`/api/notifications/${n.id}/read`, { method: "PATCH" })));
    setMarkingAll(false);
  }

  function openNotif(n: Notification) {
    if (!n.read) markRead(n.id);
    setOpen(false);
    setSelected(n);
  }

  const cfg = (n: Notification) => TYPE_CONFIG[n.type] ?? { icon: <Bell size={20} color="#94a3b8" />, bg: "rgba(255,255,255,0.04)", color: "#94a3b8" };

  const NotifItem = ({ n }: { n: Notification }) => {
    const long = isLong(n);
    return (
      <div onClick={() => openNotif(n)}
        style={{
          display: "flex", gap: 12, padding: "14px 16px",
          borderBottom: "1px solid rgba(30,45,80,0.5)",
          background: n.read ? "transparent" : "rgba(245,166,35,0.04)",
          cursor: "pointer",
        }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: cfg(n).bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {cfg(n).icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span style={{ color: n.read ? "#94a3b8" : "#fff", fontWeight: n.read ? 500 : 700, fontSize: 14, flex: 1, minWidth: 0 }}>
              {n.title}
            </span>
            {!n.read && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#f5a623", flexShrink: 0 }} />}
          </div>
          <div style={{ color: "#64748b", fontSize: 13, lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" } as any}>
            {n.message}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 5 }}>
            <span style={{ color: "#475569", fontSize: 11 }}>{timeAgo(n.createdAt)}</span>
            {long && <span style={{ color: cfg(n).color, fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 2 }}>Ver tudo <ChevronRight size={11} /></span>}
          </div>
        </div>
      </div>
    );
  };

  const NotifList = () => (
    <>
      {notifications.length === 0 ? (
        <div style={{ padding: "40px 16px", textAlign: "center", color: "#475569", fontSize: 13, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <Bell size={36} color="#1e2d50" />
          Sem notificações
        </div>
      ) : (
        notifications.slice(0, 20).map(n => <NotifItem key={n.id} n={n} />)
      )}
    </>
  );

  return (
    <>
      {/* Notificação expandida */}
      {selected && typeof document !== "undefined" && createPortal(
        <div style={{
          position: "fixed", inset: 0, zIndex: 99999,
          background: isMobile ? "#080e1d" : "rgba(0,0,0,0.75)",
          display: "flex",
          alignItems: isMobile ? "flex-start" : "center",
          justifyContent: "center",
          padding: isMobile ? 0 : 20,
        }}
          onClick={e => { if (!isMobile && e.target === e.currentTarget) setSelected(null); }}>
          <div style={{
            background: "#111827",
            border: isMobile ? "none" : "1px solid #1e2d50",
            borderRadius: isMobile ? 0 : 16,
            width: "100%", maxWidth: isMobile ? "100%" : 480,
            height: isMobile ? "100%" : "auto",
            maxHeight: isMobile ? "100%" : "80vh",
            display: "flex", flexDirection: "column", overflow: "hidden",
          }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: "1px solid #1e2d50", flexShrink: 0 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: cfg(selected).bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {cfg(selected).icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: "#fff", fontWeight: 800, fontSize: 15, lineHeight: 1.3 }}>{selected.title}</div>
                <div style={{ color: "#475569", fontSize: 12, marginTop: 3 }}>{timeAgo(selected.createdAt)}</div>
              </div>
              <button onClick={() => setSelected(null)}
                style={{ background: "#1e2d50", border: "none", borderRadius: 8, width: 34, height: 34, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <X size={15} color="#94a3b8" />
              </button>
            </div>
            {/* Body */}
            <div style={{ padding: "24px 20px", overflowY: "auto", flex: 1 }}>
              {(() => {
                const urlMatch = selected.message.match(/https?:\/\/[^\s]+/);
                const cleanMsg = selected.message.replace(/https?:\/\/[^\s]+/, "").trim();
                return (
                  <>
                    <div style={{ color: "#d1d5db", fontSize: 15, lineHeight: 1.8, whiteSpace: "pre-wrap", marginBottom: urlMatch ? 24 : 0 }}>
                      {cleanMsg}
                    </div>
                    {urlMatch && (
                      <a href={urlMatch[0]} target="_blank" rel="noopener noreferrer"
                        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: "#25d366", color: "#fff", borderRadius: 12, padding: "14px 20px", textDecoration: "none", fontWeight: 800, fontSize: 15 }}>
                        <MessageCircle size={18} /> Entrar no grupo
                        <ExternalLink size={14} style={{ opacity: 0.7 }} />
                      </a>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Bell button */}
      <div ref={ref} style={{ position: "relative" }}>
        <button onClick={() => setOpen(o => !o)}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 4, position: "relative", display: "flex", alignItems: "center", color: "#94a3b8" }}>
          <Bell size={18} />
          {unread > 0 && (
            <span style={{ position: "absolute", top: 0, right: 0, background: "#ef4444", color: "#fff", borderRadius: "50%", fontSize: 9, fontWeight: 800, minWidth: 14, height: 14, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 2px" }}>
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>

        {/* Desktop dropdown */}
        {!isMobile && open && (
          <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: 340, background: "#111827", border: "1px solid #1e2d50", borderRadius: 14, boxShadow: "0 8px 40px rgba(0,0,0,0.6)", zIndex: 1000, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px", borderBottom: "1px solid #1e2d50" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>Notificações</span>
                {unread > 0 && <span style={{ background: "#ef4444", color: "#fff", borderRadius: 10, fontSize: 11, fontWeight: 700, padding: "1px 7px" }}>{unread}</span>}
              </div>
              {unread > 0 && (
                <button onClick={markAll} disabled={markingAll} style={{ background: "none", border: "none", cursor: "pointer", color: "#f5a623", fontSize: 11, fontWeight: 600 }}>
                  Ler todas
                </button>
              )}
            </div>
            <div style={{ maxHeight: 420, overflowY: "auto" }}>
              <NotifList />
            </div>
          </div>
        )}
      </div>

      {/* Mobile — ecrã inteiro via portal */}
      {isMobile && open && typeof document !== "undefined" && createPortal(
        <div style={{
          position: "fixed", inset: 0, zIndex: 99999,
          background: "#080e1d", display: "flex", flexDirection: "column",
        }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 16px 12px", borderBottom: "1px solid #1e2d50", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Bell size={20} color="#f5a623" />
              <span style={{ color: "#fff", fontWeight: 800, fontSize: 17 }}>Notificações</span>
              {unread > 0 && (
                <span style={{ background: "#ef4444", color: "#fff", borderRadius: 10, fontSize: 11, fontWeight: 700, padding: "2px 8px" }}>
                  {unread}
                </span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {unread > 0 && (
                <button onClick={markAll} disabled={markingAll}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#f5a623", fontSize: 13, fontWeight: 600 }}>
                  Ler todas
                </button>
              )}
              <button onClick={() => setOpen(false)}
                style={{ background: "#1e2d50", border: "none", borderRadius: 10, width: 34, height: 34, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={16} color="#94a3b8" />
              </button>
            </div>
          </div>
          {/* Lista */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            <NotifList />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
