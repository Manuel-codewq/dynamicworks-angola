"use client";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { X, Bell, CheckCircle, XCircle, ArrowUpCircle, ScanFace, Megaphone, Info } from "lucide-react";

interface Notif {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

function ToastIcon({ type }: { type: string }) {
  const s = { size: 18 };
  if (type === "deposit_completed")    return <CheckCircle   {...s} color="#22c55e" />;
  if (type === "deposit_rejected")     return <XCircle       {...s} color="#ef4444" />;
  if (type === "withdrawal_completed") return <ArrowUpCircle {...s} color="#22c55e" />;
  if (type === "withdrawal_rejected")  return <XCircle       {...s} color="#ef4444" />;
  if (type === "kyc_approved")         return <ScanFace      {...s} color="#22c55e" />;
  if (type === "kyc_rejected")         return <ScanFace      {...s} color="#ef4444" />;
  if (type === "broadcast")            return <Megaphone     {...s} color="#f5a623" />;
  if (type === "admin")                return <Info          {...s} color="#38bdf8" />;
  return <Bell {...s} color="#94a3b8" />;
}

function accentColor(type: string) {
  if (type.includes("completed") || type === "kyc_approved") return "#22c55e";
  if (type.includes("rejected")  || type === "kyc_rejected") return "#ef4444";
  if (type === "broadcast") return "#f5a623";
  if (type === "admin")     return "#38bdf8";
  return "#94a3b8";
}

export default function NotificationToast() {
  const { status } = useSession();
  const [queue,   setQueue]   = useState<Notif[]>([]);
  const seenIds               = useRef<Set<string>>(new Set());
  const initialized           = useRef(false);

  useEffect(() => {
    if (status !== "authenticated") return;

    async function poll() {
      try {
        const res = await fetch("/api/notifications");
        if (!res.ok) return;
        const data: Notif[] = await res.json();

        // Na primeira chamada apenas marca os IDs como vistos (não mostra toasts de notificações antigas)
        if (!initialized.current) {
          data.forEach(n => seenIds.current.add(n.id));
          initialized.current = true;
          return;
        }

        // Notificações novas = IDs que ainda não vimos
        const newOnes = data.filter(n => !seenIds.current.has(n.id) && !n.read);
        newOnes.forEach(n => seenIds.current.add(n.id));
        if (newOnes.length > 0) setQueue(prev => [...prev, ...newOnes]);
      } catch {}
    }

    poll();
    const id = setInterval(poll, 15_000);
    return () => clearInterval(id);
  }, [status]);

  function dismiss(id: string) {
    setQueue(prev => prev.filter(n => n.id !== id));
    fetch(`/api/notifications/${id}/read`, { method: "PATCH" }).catch(() => {});
  }

  if (queue.length === 0) return null;

  return (
    <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999, display: "flex", flexDirection: "column", gap: 10, maxWidth: 340, width: "calc(100vw - 32px)" }}>
      {queue.slice(0, 5).map(n => (
        <ToastItem key={n.id} n={n} onDismiss={() => dismiss(n.id)} />
      ))}
    </div>
  );
}

function ToastItem({ n, onDismiss }: { n: Notif; onDismiss: () => void }) {
  const color = accentColor(n.type);

  useEffect(() => {
    const t = setTimeout(onDismiss, 6000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div style={{
      background: "#111827",
      border: `1px solid ${color}40`,
      borderLeft: `3px solid ${color}`,
      borderRadius: 12,
      padding: "12px 14px",
      boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
      display: "flex",
      gap: 12,
      alignItems: "flex-start",
      animation: "slideIn 0.25s ease",
    }}>
      <style>{`@keyframes slideIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}`}</style>

      <div style={{ width: 34, height: 34, borderRadius: 8, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <ToastIcon type={n.type} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: "#fff", fontWeight: 700, fontSize: 13, marginBottom: 3 }}>{n.title}</div>
        <div style={{ color: "#94a3b8", fontSize: 12, lineHeight: 1.5 }}>{n.message}</div>
      </div>

      <button onClick={onDismiss} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", display: "flex", flexShrink: 0, padding: 2 }}>
        <X size={14} />
      </button>
    </div>
  );
}
