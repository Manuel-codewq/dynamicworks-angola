"use client";
import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

const TYPE_ICON: Record<string, string> = {
  deposit_completed:    "💰",
  deposit_rejected:     "❌",
  withdrawal_completed: "💸",
  withdrawal_rejected:  "❌",
  kyc_approved:         "✅",
  kyc_rejected:         "⚠️",
};

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60)   return "agora mesmo";
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  return `há ${Math.floor(diff / 86400)} d`;
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const unread = notifications.filter(n => !n.read).length;

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
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

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

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: "none", border: "none", cursor: "pointer", padding: 4,
          position: "relative", display: "flex", alignItems: "center", color: "#94a3b8",
        }}
      >
        <Bell size={18} />
        {unread > 0 && (
          <span style={{
            position: "absolute", top: 0, right: 0, background: "#ef4444", color: "#fff",
            borderRadius: "50%", fontSize: 9, fontWeight: 800, minWidth: 14, height: 14,
            display: "flex", alignItems: "center", justifyContent: "center", padding: "0 2px",
            lineHeight: 1,
          }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", right: 0, width: 320,
          background: "#111827", border: "1px solid #1e2d50", borderRadius: 12,
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)", zIndex: 1000, overflow: "hidden",
        }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 16px", borderBottom: "1px solid #1e2d50",
          }}>
            <span style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>Notificações</span>
            {unread > 0 && (
              <button
                onClick={markAll}
                disabled={markingAll}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "#f5a623", fontSize: 11, fontWeight: 600,
                }}
              >
                Marcar todas como lidas
              </button>
            )}
          </div>

          <div style={{ maxHeight: 380, overflowY: "auto" }}>
            {notifications.length === 0 ? (
              <div style={{ padding: "24px 16px", textAlign: "center", color: "#475569", fontSize: 13 }}>
                Sem notificações
              </div>
            ) : (
              notifications.slice(0, 10).map(n => (
                <div
                  key={n.id}
                  onClick={() => !n.read && markRead(n.id)}
                  style={{
                    display: "flex", gap: 10, padding: "12px 16px",
                    borderBottom: "1px solid rgba(30,45,80,0.4)",
                    background: n.read ? "transparent" : "rgba(245,166,35,0.04)",
                    cursor: n.read ? "default" : "pointer",
                    transition: "background 0.15s",
                  }}
                >
                  <div style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>
                    {TYPE_ICON[n.type] ?? "🔔"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      color: n.read ? "#94a3b8" : "#fff", fontWeight: n.read ? 400 : 600,
                      fontSize: 13, marginBottom: 2,
                    }}>
                      {n.title}
                      {!n.read && (
                        <span style={{
                          display: "inline-block", width: 6, height: 6, borderRadius: "50%",
                          background: "#f5a623", marginLeft: 6, verticalAlign: "middle",
                        }} />
                      )}
                    </div>
                    <div style={{ color: "#64748b", fontSize: 12, lineHeight: 1.4 }}>{n.message}</div>
                    <div style={{ color: "#475569", fontSize: 11, marginTop: 4 }}>{timeAgo(n.createdAt)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
