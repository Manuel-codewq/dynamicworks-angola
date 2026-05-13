"use client";
import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";

export default function PushManager() {
  const { status } = useSession();
  const done = useRef(false);

  useEffect(() => {
    if (status !== "authenticated" || done.current) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (Notification.permission === "denied") return;

    done.current = true;

    async function subscribe() {
      try {
        const reg = await navigator.serviceWorker.ready;

        // Verificar se já tem subscrição activa
        const existing = await reg.pushManager.getSubscription();
        if (existing) {
          // Confirmar no servidor (pode ter sido apagada)
          const res = await fetch("/api/push/subscribe");
          const { publicKey } = await res.json();
          if (!publicKey) return;
          // Re-registar se a chave mudou
          const sub = existing.toJSON() as any;
          await fetch("/api/push/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: sub.endpoint, keys: sub.keys }),
          });
          return;
        }

        // Pedir permissão pela primeira vez
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;

        // Obter chave pública
        const res = await fetch("/api/push/subscribe");
        const { publicKey } = await res.json();
        if (!publicKey) return;

        // Criar subscrição
        const subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as any,
        });

        const sub = subscription.toJSON() as any;
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint, keys: sub.keys }),
        });
      } catch {
        // Silent — push não é crítico
      }
    }

    // Pequeno delay para não bloquear o carregamento inicial
    const t = setTimeout(subscribe, 3000);
    return () => clearTimeout(t);
  }, [status]);

  return null;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
