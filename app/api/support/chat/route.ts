import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rateLimit";
import { sendPushToAdmins } from "@/lib/webPush";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `És o assistente de suporte da Dynamic Works, uma plataforma de trading de opções binárias angolana.

Responde SEMPRE em Português de Angola. Sê directo, amigável e profissional.

CONHECIMENTO DA PLATAFORMA:
- Depósitos: mínimo 5.000 Kz via Multicaixa (Entidade 10116 / Referência 946621503). O utilizador faz o depósito no ATM ou app Multicaixa Express e depois envia o comprovativo através do formulário de depósito. O admin aprova manualmente.
- Levantamentos: mínimo 1.000 Kz via Multicaixa Express (número de telefone) ou Transferência Bancária. Taxa de 5%. Requer KYC aprovado.
- Bónus: 10% no primeiro depósito de 50.000 Kz ou mais.
- KYC: verificação de identidade obrigatória para levantar. Enviar BI/passaporte. Prazo de análise: 1-3 dias úteis.
- Conta Demo: saldo de 10.000 Kz para praticar, pode ser reposto até 3x por hora.
- Trades: opções binárias de 30 segundos a 1 hora. Payout médio de 85%. Pares disponíveis: Forex, Cripto, Metais, Índices sintéticos 24/7.
- 2FA: autenticação de dois factores por email disponível em /security.
- Referidos: programa DW-XXXX, comissão de 2% no primeiro depósito do convidado.
- Suporte WhatsApp: +244 921 825 299.
- Torneios: competições com prémios, entrada via saldo demo ou real.

QUANDO ESCALAR PARA HUMANO:
Responde com a palavra ESCALAR (em maiúsculas) no início da tua resposta quando:
- O utilizador pede para falar com uma pessoa/admin/suporte humano
- A questão envolve um problema técnico específico da conta que não consegues resolver (saldo errado, trade com problema, pagamento não aprovado há mais de 48h)
- A questão envolve reclamação formal ou disputa de valores
- Não tens informação suficiente para ajudar

Quando escalas, escreve "ESCALAR" na primeira linha e depois uma explicação breve do problema para o admin.

LIMITAÇÕES:
- Não tens acesso ao saldo, histórico ou dados pessoais do utilizador.
- Não podes aprovar depósitos, levantamentos ou KYC.
- Não podes alterar saldos ou dados da conta.

FORMATO:
- Nunca uses emojis nas respostas.
- Nunca uses formatação Markdown: sem asteriscos, sem #, sem **, sem *, sem listas com hífen ou asterisco.
- Escreve em texto corrido, simples e limpo.
- Sê conciso — máximo 3 parágrafos por resposta.`;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  if (!await checkRateLimit("ai-chat", session.user.id, 30, 60 * 60_000)) {
    return NextResponse.json({ error: "Demasiadas mensagens. Tenta mais tarde." }, { status: 429 });
  }

  const { messages } = await req.json();
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "Mensagens inválidas." }, { status: 400 });
  }

  // Validar e limitar histórico (máx 20 mensagens, cada uma máx 1000 chars)
  const history: { role: "user" | "assistant"; content: string }[] = messages.slice(-20).map((m: any) => ({
    role:    m.role === "assistant" ? "assistant" as const : "user" as const,
    content: String(m.content ?? "").slice(0, 1000),
  }));

  const response = await client.messages.create({
    model:      "claude-haiku-4-5-20251001",
    max_tokens: 512,
    system:     SYSTEM_PROMPT,
    messages:   history,
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const shouldEscalate = text.trimStart().startsWith("ESCALAR");

  if (shouldEscalate) {
    // Criar ticket com resumo da conversa
    const user = await prisma.user.findUnique({
      where:  { id: session.user.id },
      select: { name: true, email: true },
    });

    const conversationSummary = history
      .map(m => `${m.role === "user" ? "Utilizador" : "IA"}: ${m.content}`)
      .join("\n");

    const ticket = await prisma.supportTicket.create({
      data: {
        userId:   session.user.id,
        subject:  "Escalamento via chat IA",
        category: "tecnico",
        status:   "open",
        messages: {
          create: {
            body:    `Conversa transferida pelo assistente IA:\n\n${conversationSummary}`,
            isAdmin: false,
          },
        },
      },
    });

    // Notificar admins via push
    sendPushToAdmins({
      title: "Novo pedido de suporte",
      body:  `${user?.name ?? "Utilizador"} precisa de ajuda — chat IA escalou para humano.`,
      url:   `/ao/admin/support`,
      tag:   `support-${ticket.id}`,
    }).catch(() => {});

    // Criar notificação in-app para o utilizador
    await prisma.notification.create({
      data: {
        userId:  session.user.id,
        type:    "support_escalated",
        title:   "Pedido enviado ao suporte",
        message: "A tua questão foi encaminhada para a equipa de suporte. Receberás resposta em breve.",
      },
    });

    return NextResponse.json({ reply: text.replace(/^ESCALAR\n?/, "").trim(), escalated: true, ticketId: ticket.id });
  }

  return NextResponse.json({ reply: text, escalated: false });
}
