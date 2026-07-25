import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";

// symbol -> set de clients subscritos
const subscriptions = new Map<string, Set<WebSocket>>();

let wss: WebSocketServer;

export function initWebSocketServer(httpServer: Server) {
  wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (socket) => {
    socket.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "subscribe" && typeof msg.symbol === "string") {
          if (!subscriptions.has(msg.symbol)) {
            subscriptions.set(msg.symbol, new Set());
          }
          subscriptions.get(msg.symbol)!.add(socket);
        }
        if (msg.type === "unsubscribe" && typeof msg.symbol === "string") {
          subscriptions.get(msg.symbol)?.delete(socket);
        }
      } catch {
        // mensagem inválida, ignora
      }
    });

    socket.on("close", () => {
      for (const set of subscriptions.values()) {
        set.delete(socket);
      }
    });
  });

  console.log("[ws] servidor WebSocket iniciado em /ws");
}

export function broadcastTick(symbol: string, price: number) {
  const clients = subscriptions.get(symbol);
  if (!clients || clients.size === 0) return;

  const payload = JSON.stringify({
    type: "tick",
    symbol,
    price,
    timestamp: Date.now(),
  });

  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}
