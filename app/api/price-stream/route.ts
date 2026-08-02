import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/getClientIp";

// Proxy interno — o browser nunca liga directamente ao synthetic-engine (só
// acessível na rede interna/localhost do servidor). Este Route Handler abre
// o WebSocket ao synthetic-engine do lado do servidor (dentro da função
// serverless, enquanto ela está viva) e reencaminha os ticks para o browser
// via SSE (Server-Sent Events — um stream HTTP normal, suportado pelo
// Vercel; um servidor WebSocket persistente dentro de app/api/.../route.ts
// não é, porque não há processo Node persistente no plano serverless).
//
// maxDuration: plano Vercel confirmado Pro (tecto 300s) — 270s fica com
// margem de segurança abaixo desse tecto. O EventSource do browser
// (lib/derivWebSocket.ts) já reconecta sozinho quando o stream fecha, por
// isso mesmo que o tecto do plano mude no futuro, isto degrada (reconecta
// mais vezes) em vez de partir.
export const maxDuration = 270;

// Fecha a ligação pró-activamente um pouco antes do tecto da função —
// não confiar em o req.signal disparar "abort" a tempo quando o Vercel mata
// a execução por exceder maxDuration (o comportamento exacto nesse cenário
// não é garantido). Isto assegura que o WebSocket ao synthetic-engine é
// sempre fechado pelo nosso código, nunca fica pendurado a consumir um slot
// do pool de ligações lá do lado — o EventSource do browser reconecta
// sozinho a seguir, tal como já faz quando o stream termina por qualquer
// outra razão.
const HARD_CLOSE_MS = 265_000;

const SYNTHETIC_ENGINE_URL    = process.env.SYNTHETIC_ENGINE_URL ?? "http://localhost:4001";
const SYNTHETIC_ENGINE_WS_URL = SYNTHETIC_ENGINE_URL.replace(/^http/, "ws") + "/ws";

const KEEP_ALIVE_MS = 15_000;

// Endpoint público (sem login — visitantes vêem o gráfico ao vivo antes de
// se registarem, isso é bom para conversão). Cada pedido mantém uma ligação
// WebSocket aberta ao synthetic-engine até 270s — sem limite, um atacante
// consegue esgotar slots de função Vercel e o pool de ligações do
// synthetic-engine só com pedidos repetidos (já aconteceu um incidente de
// esgotamento desse pool com tráfego legítimo a 24 símbolos). Um cliente
// legítimo abre 1-2 ligações (uma aba, talvez duas) — o limite fica muito
// acima disso de propósito.
const MAX_NEW_CONNECTIONS_PER_MIN = 10;

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  if (!await checkRateLimit("price-stream", ip, MAX_NEW_CONNECTIONS_PER_MIN, 60_000)) {
    return NextResponse.json({ error: "Demasiadas ligações. Aguarda um momento." }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const symbols = (searchParams.get("symbols") ?? "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      let keepAlive: ReturnType<typeof setInterval> | null = null;

      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch { /* controller já fechado — corrida com o cleanup */ }
      };

      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (keepAlive) clearInterval(keepAlive);
        clearTimeout(hardClose);
        try { ws.close(); } catch {}
        try { controller.close(); } catch {}
      };

      // Ver comentário de HARD_CLOSE_MS acima do handler — fecha sempre por
      // este timer, não depende do req.signal disparar a tempo.
      const hardClose = setTimeout(cleanup, HARD_CLOSE_MS);

      const ws = new WebSocket(SYNTHETIC_ENGINE_WS_URL);

      ws.addEventListener("open", () => {
        for (const symbol of symbols) {
          ws.send(JSON.stringify({ type: "subscribe", symbol }));
        }
        send("connected", { ok: true });
      });

      ws.addEventListener("message", (ev) => {
        try {
          const msg = JSON.parse(ev.data as string);
          if (msg?.type === "tick") send("tick", msg);
        } catch { /* mensagem inválida do synthetic-engine, ignora */ }
      });

      ws.addEventListener("error", () => send("stream-error", { message: "synthetic-engine indisponível" }));
      ws.addEventListener("close", cleanup);

      // Alguns proxies intermédios fecham ligações HTTP inactivas — um
      // comentário SSE periódico ( linhas ":" são ignoradas pelo EventSource)
      // mantém o stream vivo mesmo sem ticks novos.
      keepAlive = setInterval(() => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(": keep-alive\n\n")); } catch {}
      }, KEEP_ALIVE_MS);

      req.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection":    "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
