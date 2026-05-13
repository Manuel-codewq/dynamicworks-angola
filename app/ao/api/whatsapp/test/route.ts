import { NextRequest, NextResponse } from "next/server";

/**
 * Endpoint de diagnóstico — apenas para desenvolvimento/teste
 * GET  /ao/api/whatsapp/test              → mostra configuração
 * POST /ao/api/whatsapp/test?to=244...    → envia mensagem de teste
 */

export async function GET() {
  const instanceId = process.env.ZAPI_INSTANCE_ID;
  const token = process.env.ZAPI_TOKEN;
  const clientToken = process.env.ZAPI_CLIENT_TOKEN;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  // Testa conexão ao Z-API
  let zapiStatus = "❌ Não configurado";
  let zapiDetail = "";

  if (instanceId && token) {
    try {
      const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/status`;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (clientToken) headers["Client-Token"] = clientToken;

      const res = await fetch(url, { headers });
      const data = await res.json().catch(() => ({}));
      zapiStatus = res.ok ? "✅ Conectado" : `❌ Erro ${res.status}`;
      zapiDetail = JSON.stringify(data);
    } catch (e) {
      zapiStatus = "❌ Falha de rede";
      zapiDetail = String(e);
    }
  }

  return NextResponse.json({
    config: {
      ZAPI_INSTANCE_ID: instanceId ? `${instanceId.slice(0, 8)}...` : "❌ FALTA",
      ZAPI_TOKEN: token ? `${token.slice(0, 6)}...` : "❌ FALTA",
      ZAPI_CLIENT_TOKEN: clientToken ? `${clientToken.slice(0, 6)}...` : "⚠️  não definido (pode ser obrigatório)",
      ANTHROPIC_API_KEY: anthropicKey ? `${anthropicKey.slice(0, 16)}...` : "❌ FALTA",
    },
    zapi: {
      status: zapiStatus,
      detail: zapiDetail,
    },
    webhook_url: "https://dynamicworks.ao/ao/api/whatsapp/webhook",
  });
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const to = searchParams.get("to"); // ex: ?to=244923456789

  if (!to) {
    return NextResponse.json(
      { error: "Passa o número no query: ?to=244923456789" },
      { status: 400 }
    );
  }

  const instanceId = process.env.ZAPI_INSTANCE_ID;
  const token = process.env.ZAPI_TOKEN;
  const clientToken = process.env.ZAPI_CLIENT_TOKEN;

  if (!instanceId || !token) {
    return NextResponse.json(
      { error: "ZAPI_INSTANCE_ID ou ZAPI_TOKEN não configurados" },
      { status: 500 }
    );
  }

  const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (clientToken) headers["Client-Token"] = clientToken;

  const phone = to.replace(/^\+/, "").trim();

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ phone, message: "✅ Teste Dynamics Works — bot WhatsApp funcionando!" }),
    });

    const responseText = await res.text();
    let responseJson;
    try { responseJson = JSON.parse(responseText); } catch { responseJson = responseText; }

    return NextResponse.json({
      sent_to: phone,
      zapi_status: res.status,
      zapi_ok: res.ok,
      zapi_response: responseJson,
    }, { status: res.ok ? 200 : 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
