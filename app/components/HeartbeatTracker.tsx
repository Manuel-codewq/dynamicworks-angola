"use client";
import { useEffect } from "react";
import { useSession } from "next-auth/react";

const INTERVAL_MS = 60_000; // ping a cada 60 segundos

export default function HeartbeatTracker() {
  const { status } = useSession();

  useEffect(() => {
    if (status !== "authenticated") return;

    function ping() {
      fetch("/api/heartbeat", { method: "POST" }).catch(() => {});
    }

    // Ping imediato ao carregar a página, depois a cada 60s
    ping();
    const id = setInterval(ping, INTERVAL_MS);
    return () => clearInterval(id);
  }, [status]);

  return null;
}
