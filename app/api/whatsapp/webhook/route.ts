import { NextRequest, NextResponse } from "next/server";
import { sendWhatsAppMessage, buildWelcomeMessage } from "@/lib/whatsapp";
import crypto from "crypto";

const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN!;
const APP_SECRET   = process.env.WHATSAPP_APP_SECRET;

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

// Valida a assinatura HMAC-SHA256 que a Meta envia em X-Hub-Signature-256,
// calculada sobre o corpo bruto do pedido com o App Secret. Sem isto, qualquer
// pessoa que descubra a URL pode forjar eventos de webhook.
function isValidMetaSignature(rawBody: string, header: string | null): boolean {
  if (!APP_SECRET || !header?.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", APP_SECRET).update(rawBody).digest("hex");
  const provided = header.slice("sha256=".length);
  const expectedBuf = Buffer.from(expected, "hex");
  const providedBuf = Buffer.from(provided, "hex");
  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

// Meta envia mensagens recebidas via POST
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  if (!isValidMetaSignature(rawBody, req.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
  }
  const body = JSON.parse(rawBody);

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
