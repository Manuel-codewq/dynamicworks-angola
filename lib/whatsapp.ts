import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

// ─── Anthropic Client ────────────────────────────────────────────────────────
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// ─── System Prompt ───────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `És o assistente de suporte oficial da Dynamics Works Angola — uma plataforma de negociação de opções binárias.

IDENTIDADE:
- O teu nome é "Suporte Dynamics Works"
- Trabalhas exclusivamente para a Dynamics Works Angola
- Respondes sempre em Português de Angola, de forma cordial e profissional
- A plataforma Dynamics Works foi desenvolvida pela empresa DIGIKAP LDA
- Se alguém perguntar quem desenvolveu a plataforma ou a corretora, responde que foi a DIGIKAP LDA

CONHECIMENTO:
- Depósitos: feitos via Multicaixa Express (EMIS), o saldo é creditado em até 5 minutos após confirmação
- Saques/Levantamentos: processados em 24 horas úteis, valor mínimo de 5.000 AOA
- Negociação: a plataforma oferece opções binárias com prazos de 30s a 5 minutos, payout de 85%
- Conta Demo: todos os utilizadores têm 10.000 AOA de saldo demo para praticar sem risco
- KYC (Verificação de Identidade): necessário para saques, feito com selfie e foto do B.I.
- Problemas de senha: podem ser resolvidos via "Esqueci a senha" no ecrã de login
- Suporte humano: disponível por email suporte@dynamicsworks.ao e whatsapp +244 921 825 299

REGRAS CRÍTICAS:
- NUNCA prometeres lucros garantidos — o trading tem riscos
- NUNCA pedires senhas, PINs ou dados bancários completos
- NUNCA inventares informações que não sabes
- Se não souberes responder, diz que vais encaminhar para a equipa humana

Quando tiveres dados do utilizador, usa-os para personalizar a resposta (ex: "Olá João, o teu saldo é de 15.000 AOA...").`;

// ─── askAI ────────────────────────────────────────────────────────────────────
type MessageParam = { role: "user" | "assistant"; content: string };

export async function askAI(
  userMessage: string,
  userContext: string,
  history: MessageParam[]
): Promise<string> {
  const systemWithContext = userContext
    ? `${SYSTEM_PROMPT}\n\n--- DADOS DO UTILIZADOR ---\n${userContext}`
    : SYSTEM_PROMPT;

  // Garante que o histórico alterna corretamente (user/assistant)
  const safeHistory: MessageParam[] = history.slice(-10); // últimas 10 mensagens

  const messages: MessageParam[] = [
    ...safeHistory,
    { role: "user", content: userMessage },
  ];

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 500,
    system: systemWithContext,
    messages,
  });

  const block = response.content[0];
  if (block.type === "text") return block.text;
  return "Desculpa, não consegui processar a tua mensagem. Tenta novamente.";
}

// ─── sendWhatsApp (Z-API) ─────────────────────────────────────────────────────
export async function sendWhatsApp(to: string, text: string): Promise<void> {
  const instanceId = process.env.ZAPI_INSTANCE_ID!;
  const token = process.env.ZAPI_TOKEN!;
  const clientToken = process.env.ZAPI_CLIENT_TOKEN;

  const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (clientToken) {
    headers["Client-Token"] = clientToken;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ phone: to, message: text }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[sendWhatsApp] Erro ${res.status}:`, body);
    throw new Error(`Z-API error ${res.status}`);
  }
}

// ─── getOrCreateTicket ────────────────────────────────────────────────────────
export async function getOrCreateTicket(userId: string): Promise<string> {
  // Procura ticket aberto de WhatsApp
  const existing = await prisma.supportTicket.findFirst({
    where: { userId, category: "whatsapp", status: "open" },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  if (existing) return existing.id;

  // Cria novo ticket
  const ticket = await prisma.supportTicket.create({
    data: {
      userId,
      subject: "Suporte via WhatsApp",
      category: "whatsapp",
      status: "open",
    },
    select: { id: true },
  });

  return ticket.id;
}

// ─── saveMessage ──────────────────────────────────────────────────────────────
export async function saveMessage(
  ticketId: string,
  body: string,
  isAdmin: boolean
): Promise<void> {
  await prisma.supportMessage.create({
    data: { ticketId, body, isAdmin },
  });

  // Atualiza updatedAt do ticket
  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { updatedAt: new Date() },
  });
}
