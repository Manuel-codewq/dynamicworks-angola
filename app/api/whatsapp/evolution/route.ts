import { NextRequest, NextResponse } from "next/server";
import { handleIncomingMessage } from "@/lib/evolutionApi";

export async function POST(req: NextRequest) {
  try {
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
