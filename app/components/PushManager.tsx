"use client";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Bell, X } from "lucide-react";

export default function PushManager() {
  const { status } = useSession();
  const done = useRef(false);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (done.current) return;
    done.current = true;

    // Regista o service worker
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});

    const perm = Notification.permission;
    if (perm === "granted") {
      // Já tem permissão — subscrever silenciosamente
      setTimeout(() => subscribe(), 1000);
    } else if (perm === "default") {
      // Ainda não pediu — mostrar banner após 5s
      setTimeout(() => setShowBanner(true), 5000);
    }
    // "denied" — não fazer nada
  }, [status]);

  async function subscribe() {
    try {
      await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      const reg = await navigator.serviceWorker.ready;

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        const res = await fetch("/api/push/subscribe");
        const { publicKey } = await res.json();
        if (!publicKey) return;
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as ArrayBuffer,
        });
      }

      const s = sub.toJSON() as any;
      await fetch("/api/push/subscribe", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ endpoint: s.endpoint, keys: s.keys }),
      });
    } catch {
      // Silent — push não é crítico
    }
  }

  async function handleAllow() {
    setShowBanner(false);
    const perm = await Notification.requestPermission();
    if (perm === "granted") subscribe();
  }

  if (!showBanner) return null;

  return (
    <div style={{
      position: "fixed", bottom: 70, left: 12, right: 12, zIndex: 1000,
      background: "#111827", border: "1px solid rgba(245,166,35,0.4)",
      borderRadius: 14, padding: "14px 16px",
      boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", gap: 12,
      animation: "slideUp 0.3s ease",
    }}>
      <style>{`@keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>

      <div style={{
        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
        background: "rgba(245,166,35,0.15)", display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Bell size={20} color="#f5a623" />
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>Activar notificações</div>
        <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 2 }}>Recebe alertas quando as tuas operações fecham</div>
      </div>

      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <button
          onClick={handleAllow}
          style={{ background: "#f5a623", color: "#0a0f1e", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          Activar
        </button>
        <button
          onClick={() => setShowBanner(false)}
          style={{ background: "rgba(255,255,255,0.05)", border: "none", borderRadius: 8, width: 34, height: 34, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <X size={16} color="#94a3b8" />
        </button>
      </div>
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw     = atob(base64);
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}
