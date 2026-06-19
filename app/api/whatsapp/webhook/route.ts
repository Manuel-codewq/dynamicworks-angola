import { NextRequest, NextResponse } from "next/server";
import { sendWhatsAppMessage, buildWelcomeMessage } from "@/lib/whatsapp";

const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN!;

// Meta verifica o webhook com um GET na primeira configuração
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode      = searchParams.get("hub.mode");
  const token     = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Token inválido" }, { status: 403 });
}

// Meta envia mensagens recebidas via POST
export async function POST(req: NextRequest) {
  const body = await req.json();

  const entry    = body?.entry?.[0];
  const changes  = entry?.changes?.[0];
  const value    = changes?.value;
  const messages = value?.messages;

  if (!messages?.length) return NextResponse.json({ status: "ok" });

  const msg     = messages[0];
  const from    = msg.from;                          // número do utilizador
  const type    = msg.type;                          // "text", "image", etc.
  const contact = value?.contacts?.[0];
  const name    = contact?.profile?.name;

  // Só responde a mensagens de texto
  if (type !== "text") return NextResponse.json({ status: "ok" });

  const text = msg.text?.body?.toLowerCase() ?? "";

  // Resposta de boas-vindas para qualquer primeira mensagem
  const welcome = buildWelcomeMessage(name);
  await sendWhatsAppMessage(from, welcome);

  // Se o utilizador perguntar sobre conta ou depósito, responde extra
  if (text.includes("conta") || text.includes("deposito") || text.includes("depósito")) {
    await sendWhatsAppMessage(
      from,
      "Para criar a tua conta na *Dynamic Works*, acede ao nosso site e regista-te em segundos! 🖥️\n\nDepois fala comigo para te guiar no primeiro depósito. 💳"
    );
  }

  return NextResponse.json({ status: "ok" });
}
