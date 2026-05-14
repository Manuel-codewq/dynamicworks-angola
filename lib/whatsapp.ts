import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

// ─── Anthropic Client ────────────────────────────────────────────────────────
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// ─── System Prompt ───────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `És o "Suporte Dynamics Works" — assistente da corretora angolana Dynamics Works (desenvolvida pela DIGIKAP LDA).

DOMÍNIO E CONTACTOS (CRÍTICO — usa SEMPRE estes valores exactos):
- Site: https://dynamicworks.ao  (ATENÇÃO: é "dynamicworks" SEM "s" no meio. NUNCA escrevas "dynamicsworks.ao" — esse domínio NÃO existe e é erro grave.)
- Email de suporte: suporte@dynamicworks.ao
- WhatsApp humano: +244 921 825 299
- O nome da marca tem "s" (Dynamics Works) mas o domínio NÃO tem (dynamic­works.ao). Não confundas.

ESTILO:
- Responde sempre em Português de Angola, informal mas claro (trata por "tu").
- Curto e direto. Máximo 3-4 frases. Usa listas só quando ajuda mesmo.
- Sem floreios ("Espero que estejas bem...", "Será um prazer..."). Vai ao ponto.
- Quando tiveres dados do utilizador, personaliza ("Olá João, o teu saldo é...").

CONHECIMENTO BASE:
- Depósitos: USDT (TRC-20) e Promo Codes. Multicaixa Express está temporariamente indisponível. Saldo creditado em até 5 minutos após confirmação.
- Saques: 24 horas úteis. Mínimo 5.000 AOA. Requer KYC aprovado.
- Negociação: opções binárias, prazos 30s a 5 minutos. Payout varia por activo — usa o valor de "FACTOS ATUAIS" se aparecer.
- Conta Demo: 10.000 AOA grátis para praticar sem risco.
- KYC: selfie + foto do BI. Sem KYC não há saques.
- Senha esquecida: ecrã de login → "Esqueci a senha".

ESCALONAMENTO (passar para humano):
- Se o utilizador pedir "humano", "agente", "atendente", "pessoa" → confirma que já encaminhaste.
- Se demonstrar frustração forte, reclamação grave, suspeita de fraude, ou problema com dinheiro real → encaminha.
- Se não souberes responder com confiança → encaminha. NUNCA inventes.
- Para encaminhar diz SEMPRE algo como: "Vou já passar isto à equipa humana. Podes também contactar diretamente o nosso suporte no WhatsApp: +244 921 825 299. Um agente falará contigo brevemente."

PROIBIDO:
- Prometer lucros ou ganhos garantidos. Trading tem risco — diz isso quando for relevante.
- Pedir senhas, PINs, códigos OTP, ou número completo do cartão/conta.
- Inventar valores, prazos, ou políticas que não estão aqui.`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Lê payout do Settings.payout (Json: { "EURUSD": 0.85, ... })
async function getPayoutFacts(): Promise<string> {
  try {
    const s = await prisma.settings.findUnique({
      where: { id: "singleton" },
      select: { payout: true },
    });
    const map = (s?.payout as Record<string, number> | null) ?? null;
    if (!map || Object.keys(map).length === 0) return "";

    const lines = Object.entries(map)
      .slice(0, 8)
      .map(([asset, p]) => `  - ${asset}: ${Math.round(p * 100)}%`)
      .join("\n");
    return `FACTOS ATUAIS (payout por activo):\n${lines}`;
  } catch {
    return "";
  }
}

// Valida número angolano em formato Z-API (244 + 9 dígitos começando por 9)
export function isValidAoPhone(phone: string): boolean {
  const clean = phone.replace(/\D/g, "");
  return /^2449\d{8}$/.test(clean);
}

// ─── askAI ────────────────────────────────────────────────────────────────────
type MessageParam = { role: "user" | "assistant"; content: string };

export async function askAI(
  userMessage: string,
  userContext: string,
  history: MessageParam[]
): Promise<string> {
  const facts = await getPayoutFacts();
  const parts = [SYSTEM_PROMPT];
  if (facts) parts.push(`--- ${facts} ---`);
  if (userContext) parts.push(`--- DADOS DO UTILIZADOR ---\n${userContext}`);
  const systemWithContext = parts.join("\n\n");

  const safeHistory = history.slice(-10);
  const messages: MessageParam[] = [
    ...safeHistory,
    { role: "user", content: userMessage },
  ];

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 350,
    system: systemWithContext,
    messages,
  });

  const block = response.content[0];
  if (block.type === "text") return block.text;
  return "Desculpa, não consegui processar a tua mensagem. Tenta novamente.";
}

// ─── Z-API low-level ──────────────────────────────────────────────────────────

function zapiUrl(path: string): string {
  const instanceId = process.env.ZAPI_INSTANCE_ID!;
  const token = process.env.ZAPI_TOKEN!;
  return `https://api.z-api.io/instances/${instanceId}/token/${token}/${path}`;
}

function zapiHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const clientToken = process.env.ZAPI_CLIENT_TOKEN;
  if (clientToken) headers["Client-Token"] = clientToken;
  return headers;
}

// Best-effort typing indicator. Não falha se Z-API não suportar.
async function sendTyping(phone: string): Promise<void> {
  try {
    await fetch(zapiUrl("send-chat-state"), {
      method: "POST",
      headers: zapiHeaders(),
      body: JSON.stringify({ phone, chatState: "composing" }),
    });
  } catch {
    /* ignora — typing é cosmético */
  }
}

// Quebra texto em pedaços ≤ maxLen, preferindo quebrar em parágrafo/frase
function chunkText(text: string, maxLen = 900): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let rest = text.trim();
  while (rest.length > maxLen) {
    let cut = rest.lastIndexOf("\n\n", maxLen);
    if (cut < maxLen * 0.5) cut = rest.lastIndexOf("\n", maxLen);
    if (cut < maxLen * 0.5) cut = rest.lastIndexOf(". ", maxLen);
    if (cut < maxLen * 0.5) cut = maxLen;
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

async function logOutbound(
  phone: string,
  body: string,
  status: "ok" | "error",
  error?: string
): Promise<void> {
  try {
    await prisma.whatsappLog.create({
      data: { phone, direction: "out", body, status, error: error ?? null },
    });
  } catch (e) {
    console.error("[whatsapp] logOutbound falhou:", e);
  }
}

export async function logInbound(phone: string, body: string): Promise<void> {
  try {
    await prisma.whatsappLog.create({
      data: { phone, direction: "in", body, status: "ok" },
    });
  } catch (e) {
    console.error("[whatsapp] logInbound falhou:", e);
  }
}

// ─── sendWhatsApp ─────────────────────────────────────────────────────────────
export async function sendWhatsApp(to: string, text: string): Promise<void> {
  if (!isValidAoPhone(to)) {
    console.warn(`[sendWhatsApp] número inválido, ignorado: ${to}`);
    await logOutbound(to, text, "error", "invalid_phone");
    return;
  }

  const chunks = chunkText(text);
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    await sendTyping(to);

    const res = await fetch(zapiUrl("send-text"), {
      method: "POST",
      headers: zapiHeaders(),
      body: JSON.stringify({ phone: to, message: chunk }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error(`[sendWhatsApp] Erro ${res.status}:`, errBody);
      await logOutbound(to, chunk, "error", `${res.status}:${errBody.slice(0, 200)}`);
      throw new Error(`Z-API error ${res.status}`);
    }

    await logOutbound(to, chunk, "ok");

    // pequena pausa entre chunks para chegarem ordenados
    if (i < chunks.length - 1) {
      await new Promise((r) => setTimeout(r, 600));
    }
  }
}

// ─── getOrCreateTicket ────────────────────────────────────────────────────────
export async function getOrCreateTicket(userId: string): Promise<string> {
  const existing = await prisma.supportTicket.findFirst({
    where: { userId, category: "whatsapp", status: { in: ["open", "escalated"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  if (existing) return existing.id;

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

  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { updatedAt: new Date() },
  });
}

// ─── escalateTicket ───────────────────────────────────────────────────────────
export async function escalateTicket(ticketId: string): Promise<void> {
  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { status: "escalated" },
  });
}
