"use client";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { CheckCircle, XCircle, ArrowUpCircle, ScanFace, Megaphone, Info, TrendingUp, TrendingDown } from "lucide-react";

interface Notif {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  deposit_completed:    { icon: <CheckCircle   size={20} />, color: "#22c55e", bg: "rgba(34,197,94,0.12)"    },
  deposit_rejected:     { icon: <XCircle       size={20} />, color: "#ef4444", bg: "rgba(239,68,68,0.12)"    },
  withdrawal_completed: { icon: <ArrowUpCircle size={20} />, color: "#22c55e", bg: "rgba(34,197,94,0.12)"    },
  withdrawal_rejected:  { icon: <XCircle       size={20} />, color: "#ef4444", bg: "rgba(239,68,68,0.12)"    },
  kyc_approved:         { icon: <ScanFace      size={20} />, color: "#22c55e", bg: "rgba(34,197,94,0.12)"    },
  kyc_rejected:         { icon: <ScanFace      size={20} />, color: "#ef4444", bg: "rgba(239,68,68,0.12)"    },
  trade_win:            { icon: <TrendingUp    size={20} />, color: "#22c55e", bg: "rgba(34,197,94,0.12)"    },
  trade_loss:           { icon: <TrendingDown  size={20} />, color: "#ef4444", bg: "rgba(239,68,68,0.12)"    },
  broadcast:            { icon: <Megaphone     size={20} />, color: "#f5a623", bg: "rgba(245,166,35,0.12)"   },
  admin:                { icon: <Info          size={20} />, color: "#38bdf8", bg: "rgba(56,189,248,0.12)"   },
};

function getConfig(type: string) {
  return TYPE_CONFIG[type] ?? { icon: <Info size={20} />, color: "#94a3b8", bg: "rgba(148,163,184,0.08)" };
}

export default function NotificationToast() {
  const { status } = useSession();
  const [queue,       setQueue]       = useState<Notif[]>([]);
  const seenIds                        = useRef<Set<string>>(new Set());
  const initialized                    = useRef(false);

  useEffect(() => {
    if (status !== "authenticated") return;

    async function poll() {
      try {
        const res = await fetch("/api/notifications");
        if (!res.ok) return;
        const data: Notif[] = await res.json();

        if (!initialized.current) {
          data.forEach(n => seenIds.current.add(n.id));
          initialized.current = true;
          return;
        }

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
    <>
      <style>{`
        @keyframes dw-slide-in {
          from { opacity: 0; transform: translateY(-16px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)     scale(1);    }
        }
        @keyframes dw-progress {
          from { width: 100%; }
          to   { width: 0%;   }
        }
        .dw-toast { animation: dw-slide-in 0.28s cubic-bezier(0.22,1,0.36,1) forwards; }
      `}</style>
      <div style={{
        position: "fixed", top: 16, right: 16, zIndex: 9999,
        display: "flex", flexDirection: "column", gap: 10,
        maxWidth: 360, width: "calc(100vw - 32px)",
        pointerEvents: "none",
      }}>
        {queue.slice(0, 4).map(n => (
          <ToastItem key={n.id} n={n} onDismiss={() => dismiss(n.id)} />
        ))}
      </div>
    </>
  );
}

function ToastItem({ n, onDismiss }: { n: Notif; onDismiss: () => void }) {
  const cfg      = getConfig(n.type);
  const DURATION = 6000;
  const [prog, setProg] = useState(100);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef    = useRef(Date.now());

  useEffect(() => {
    const auto = setTimeout(onDismiss, DURATION);
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      setProg(Math.max(0, 100 - (elapsed / DURATION) * 100));
    }, 50);
    return () => { clearTimeout(auto); if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [onDismiss]);

  return (
    <div className="dw-toast" style={{ pointerEvents: "all" }}
      onMouseEnter={() => { if (intervalRef.current) clearInterval(intervalRef.current); }}
      onMouseLeave={() => {
        startRef.current = Date.now() - ((100 - prog) / 100 * DURATION);
        intervalRef.current = setInterval(() => {
          const elapsed = Date.now() - startRef.current;
          setProg(Math.max(0, 100 - (elapsed / DURATION) * 100));
        }, 50);
      }}>
      <div style={{
        background: "rgba(10,15,30,0.95)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: `1px solid ${cfg.color}30`,
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px ${cfg.color}15, inset 0 1px 0 rgba(255,255,255,0.05)`,
      }}>
        {/* Content */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 14px 12px" }}>
          {/* Icon */}
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: cfg.bg,
            border: `1px solid ${cfg.color}30`,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: cfg.color, flexShrink: 0,
          }}>
            {cfg.icon}
          </div>

          {/* Text */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* App label */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
              <div style={{ width: 14, height: 14, background: "linear-gradient(135deg,#f5a623,#e8940f)", borderRadius: 3, flexShrink: 0 }} />
              <span style={{ color: "#64748b", fontSize: 10, fontWeight: 600, letterSpacing: 0.3 }}>DYNAMICS WORKS</span>
            </div>
            <div style={{ color: "#ffffff", fontWeight: 700, fontSize: 13, lineHeight: 1.3, marginBottom: 3 }}>{n.title}</div>
            <div style={{ color: "#94a3b8", fontSize: 12, lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any }}>{n.message}</div>
          </div>

          {/* Close */}
          <button onClick={onDismiss} style={{
            background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 6,
            width: 22, height: 22, color: "#64748b", cursor: "pointer", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11,
          }}>✕</button>
        </div>

        {/* Progress bar */}
        <div style={{ height: 2, background: "rgba(255,255,255,0.05)" }}>
          <div style={{
            height: "100%", background: `linear-gradient(90deg, ${cfg.color}80, ${cfg.color})`,
            width: `${prog}%`, transition: "width 0.05s linear",
            borderRadius: "0 2px 2px 0",
          }} />
        </div>
      </div>
    </div>
  );
}
