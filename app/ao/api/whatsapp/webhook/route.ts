import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  askAI,
  sendWhatsApp,
  getOrCreateTicket,
  saveMessage,
} from "@/lib/whatsapp";

// ─── GET — health check (Z-API envia GET para verificar o webhook) ─────────────
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

  // Responde imediatamente para o Z-API não fazer retry
  processMessage(body).catch((err) =>
    console.error("[whatsapp/webhook] processMessage error:", err)
  );

  return NextResponse.json({ received: true });
}

// ─── processMessage ───────────────────────────────────────────────────────────
async function processMessage(body: Record<string, unknown>) {
  // 1. Ignora mensagens enviadas por nós (fromMe)
  if (body.fromMe === true) return;

  // 2. Extrai número e texto (formato Z-API)
  const rawPhone = body.phone as string | undefined;
  const textObj = body.text as Record<string, unknown> | undefined;
  const messageText = textObj?.message as string | undefined;

  if (!rawPhone || !messageText?.trim()) return;

  // Normaliza número: remove + e garante formato limpo
  const phone = rawPhone.replace(/^\+/, "").trim();

  console.log(`[whatsapp] Mensagem de ${phone}: ${messageText.slice(0, 80)}`);

  // 3. Tenta encontrar utilizador com diferentes formatos de telefone
  // Ex: "244923456789", "0923456789", "+244923456789"
  const phoneVariants = [
    phone,                                           // 244923456789
    phone.startsWith("244") ? "0" + phone.slice(3) : phone, // 0923456789
    "+" + phone,                                     // +244923456789
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

  // 4. Constrói contexto do utilizador
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

  // 5. Ticket de suporte (só para utilizadores registados)
  let ticketId: string | null = null;
  if (user) {
    ticketId = await getOrCreateTicket(user.id);
  }

  // 6. Histórico de conversa (últimas 10 mensagens do ticket)
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

  // 7. Chama a IA
  const aiReply = await askAI(messageText, userContext, history);

  // 8. Guarda mensagens no ticket (se utilizador registado)
  if (ticketId) {
    await saveMessage(ticketId, messageText, false); // mensagem do user
    await saveMessage(ticketId, aiReply, true);      // resposta da IA (admin)
  }

  // 9. Envia resposta via Z-API
  await sendWhatsApp(phone, aiReply);

  console.log(`[whatsapp] Resposta enviada para ${phone}`);
}
