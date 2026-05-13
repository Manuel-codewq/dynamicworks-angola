import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  askAI,
  sendWhatsApp,
  getOrCreateTicket,
  saveMessage,
  escalateTicket,
  logInbound,
} from "@/lib/whatsapp";

// ─── GET — health check ───────────────────────────────────────────────────────
export async function GET() {
  return NextResponse.json({ status: "ok" });
}

// ─── POST — recebe mensagens do Z-API ─────────────────────────────────────────
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ received: true });
  }

  processMessage(body).catch((err) =>
    console.error("[whatsapp/webhook] processMessage error:", err)
  );

  return NextResponse.json({ received: true });
}

// ─── Anti-spam rate limit (in-memory) ─────────────────────────────────────────
// Permite até 6 mensagens em 30s por número; depois ignora silenciosamente.
const RATE_WINDOW_MS = 30_000;
const RATE_MAX = 6;
const rateMap = new Map<string, number[]>();

function isRateLimited(phone: string): boolean {
  const now = Date.now();
  const arr = (rateMap.get(phone) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  arr.push(now);
  rateMap.set(phone, arr);
  return arr.length > RATE_MAX;
}

// ─── Detecção de tipo de mensagem ─────────────────────────────────────────────
type ParsedMessage =
  | { kind: "text"; text: string }
  | { kind: "audio" }
  | { kind: "media"; label: string }
  | { kind: "unknown" };

function parseIncoming(body: Record<string, unknown>): ParsedMessage {
  const textObj = body.text as Record<string, unknown> | undefined;
  const t = textObj?.message as string | undefined;
  if (t && t.trim()) return { kind: "text", text: t.trim() };

  if (body.audio) return { kind: "audio" };
  if (body.image) return { kind: "media", label: "imagem" };
  if (body.video) return { kind: "media", label: "vídeo" };
  if (body.document) return { kind: "media", label: "documento" };
  if (body.sticker) return { kind: "media", label: "sticker" };
  if (body.location) return { kind: "media", label: "localização" };
  if (body.contact) return { kind: "media", label: "contacto" };

  return { kind: "unknown" };
}

// ─── Comandos rápidos ─────────────────────────────────────────────────────────
const ESCALATE_TRIGGERS = /^\/(humano|agente|atendente)\b/i;

// ─── processMessage ───────────────────────────────────────────────────────────
async function processMessage(body: Record<string, unknown>) {
  if (body.fromMe === true) return;

  const rawPhone = body.phone as string | undefined;
  if (!rawPhone) return;

  const phone = rawPhone.replace(/^\+/, "").trim();

  if (isRateLimited(phone)) {
    console.warn(`[whatsapp] rate-limit: ${phone}`);
    return;
  }

  const parsed = parseIncoming(body);

  // Logs e respostas para tipos não-texto
  if (parsed.kind === "audio") {
    await logInbound(phone, "[audio]");
    await sendWhatsApp(
      phone,
      "Recebi o teu áudio, mas ainda não sei processá-lo. Por favor escreve a tua dúvida em texto que respondo já de seguida."
    );
    return;
  }
  if (parsed.kind === "media") {
    await logInbound(phone, `[${parsed.label}]`);
    await sendWhatsApp(
      phone,
      `Recebi o teu ${parsed.label}. Para te ajudar mais rápido, escreve a tua dúvida em texto se faz favor.`
    );
    return;
  }
  if (parsed.kind === "unknown") return;

  const messageText = parsed.text;
  console.log(`[whatsapp] Mensagem de ${phone}: ${messageText.slice(0, 80)}`);
  await logInbound(phone, messageText);

  // Procura utilizador por variantes de telefone
  const phoneVariants = [
    phone,
    phone.startsWith("244") ? "0" + phone.slice(3) : phone,
    "+" + phone,
  ];

  const user = await prisma.user.findFirst({
    where: { phone: { in: phoneVariants } },
    select: {
      id: true,
      name: true,
      balance: true,
      demoBalance: true,
      isDemo: true,
      kycStatus: true,
      status: true,
      trades: {
        orderBy: { createdAt: "desc" },
        take: 3,
        select: { asset: true, direction: true, result: true, profit: true },
      },
      transactions: {
        where: { status: "pending" },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: { type: true, amount: true, status: true },
      },
    },
  });

  // Ticket (só para registados)
  let ticketId: string | null = null;
  if (user) ticketId = await getOrCreateTicket(user.id);

  // Comando /humano, /agente, /atendente → escala e responde
  if (ESCALATE_TRIGGERS.test(messageText)) {
    const reply =
      "Pronto, vou já passar isto à equipa humana. Um agente fala contigo aqui mesmo assim que possível.";
    if (ticketId) {
      await escalateTicket(ticketId);
      await saveMessage(ticketId, messageText, false);
      await saveMessage(ticketId, reply, true);
    }
    await sendWhatsApp(phone, reply);
    console.log(`[whatsapp] /humano escalado para ${phone}`);
    return;
  }

  // Contexto do utilizador para a IA
  let userContext = "";
  if (user) {
    const balanceLabel = user.isDemo
      ? `Demo: ${user.demoBalance.toLocaleString("pt-AO")} AOA`
      : `Real: ${user.balance.toLocaleString("pt-AO")} AOA`;

    const tradesStr =
      user.trades.length > 0
        ? user.trades
            .map(
              (t: { asset: string; direction: string; result: string | null; profit: number | null }) =>
                `${t.asset} ${t.direction} → ${t.result ?? "activo"} (${t.profit != null ? (t.profit >= 0 ? "+" : "") + t.profit.toFixed(0) + " AOA" : "-"})`
            )
            .join(", ")
        : "Sem trades recentes";

    const txStr =
      user.transactions.length > 0
        ? user.transactions
            .map((t: { type: string; amount: number; status: string }) => `${t.type} ${t.amount} AOA (${t.status})`)
            .join(", ")
        : "Nenhuma transação pendente";

    userContext = [
      `Nome: ${user.name}`,
      `Saldo: ${balanceLabel}`,
      `Modo conta: ${user.isDemo ? "Demo" : "Real"}`,
      `KYC: ${user.kycStatus}`,
      `Estado da conta: ${user.status}`,
      `Últimos trades: ${tradesStr}`,
      `Transações pendentes: ${txStr}`,
    ].join("\n");
  }

  // Histórico
  type MessageParam = { role: "user" | "assistant"; content: string };
  let history: MessageParam[] = [];
  if (ticketId) {
    const msgs = await prisma.supportMessage.findMany({
      where: { ticketId },
      orderBy: { createdAt: "asc" },
      take: 10,
      select: { body: true, isAdmin: true },
    });
    history = msgs.map((m: { body: string; isAdmin: boolean }) => ({
      role: m.isAdmin ? ("assistant" as const) : ("user" as const),
      content: m.body,
    }));
  }

  const aiReply = await askAI(messageText, userContext, history);

  if (ticketId) {
    await saveMessage(ticketId, messageText, false);
    await saveMessage(ticketId, aiReply, true);
  }

  await sendWhatsApp(phone, aiReply);
  console.log(`[whatsapp] Resposta enviada para ${phone}`);
}
