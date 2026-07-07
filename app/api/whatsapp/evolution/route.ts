import { NextRequest, NextResponse } from "next/server";
import { handleIncomingMessage } from "@/lib/evolutionApi";
import crypto from "crypto";

const WEBHOOK_SECRET = process.env.EVOLUTION_WEBHOOK_SECRET;

export async function GET() {
  return NextResponse.json({ ok: true, service: "DynamicWorks WhatsApp Bot" });
}

// A Evolution API não assina os webhooks que envia, por isso exigimos um
// segredo partilhado (query string ou header) definido na configuração do
// webhook. Sem isto, qualquer pessoa que descubra a URL pode forjar mensagens.
function isAuthorized(req: NextRequest): boolean {
  if (!WEBHOOK_SECRET) return false;
  const provided = req.nextUrl.searchParams.get("secret") ?? req.headers.get("x-webhook-secret") ?? "";
  const expectedBuf = Buffer.from(WEBHOOK_SECRET);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

export async function POST(req: NextRequest) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    const body = await req.json();

    const event = body?.event as string | undefined;
    if (event !== "messages.upsert") return NextResponse.json({ ok: true });

    const data = body?.data;
    if (!data) return NextResponse.json({ ok: true });

    // Ignorar mensagens enviadas pelo próprio bot
    if (data?.key?.fromMe === true) return NextResponse.json({ ok: true });

    // Ignorar mensagens de grupos
    const remoteJid: string = data?.key?.remoteJid ?? "";
    if (remoteJid.endsWith("@g.us")) return NextResponse.json({ ok: true });

    // Extrair número (remover @s.whatsapp.net)
    const from = remoteJid.replace("@s.whatsapp.net", "");
    if (!from) return NextResponse.json({ ok: true });

    // Extrair texto da mensagem (suporta texto simples e extended)
    const msg = data?.message;
    const text: string =
      msg?.conversation ||
      msg?.extendedTextMessage?.text ||
      msg?.imageMessage?.caption ||
      "";

    if (!text.trim()) return NextResponse.json({ ok: true });

    const userName: string | undefined = data?.pushName || undefined;

    // Processar assincronamente — responde 200 imediatamente para a Evolution API
    handleIncomingMessage(from, text, userName).catch(e =>
      console.error("[Evolution Webhook] Erro ao processar mensagem:", e)
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[Evolution Webhook] Erro:", e);
    return NextResponse.json({ ok: true });
  }
}
