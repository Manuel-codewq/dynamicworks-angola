import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/getClientIp";
import https from "node:https";

const NIF_REGEX    = /^[A-Z0-9]{9,14}$/i; // NIF angolano: dígitos e letras
const CACHE_TTL_MS = 24 * 60 * 60_000; // 24 horas

// Usa node:https em vez de fetch() porque digital.ao faz renegociação TLS
// e o undici (fetch nativo do Node.js) não suporta renegociação, ficando pendurado.
function fetchDigitalAo(nif: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = `https://digital.ao/ao/actions/nif.ajcall.php?nif=${encodeURIComponent(nif)}`;

    const req = https.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; DynamicWorks/1.0)",
        "Accept":     "application/json",
      },
      timeout: 12000,
    }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk: string) => { body += chunk; });
      res.on("end", () => resolve(body));
    });

    req.on("timeout", () => {
      req.destroy(new Error("timeout"));
    });

    req.on("error", (err) => {
      reject(err);
    });
  });
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);

  // 10 verificações por IP por 5 minutos
  if (!await checkRateLimit("nif_lookup", ip, 10, 5 * 60_000)) {
    return NextResponse.json(
      { valid: false, error: "Demasiados pedidos. Tente mais tarde." },
      { status: 429 },
    );
  }

  const nif = req.nextUrl.searchParams.get("nif")?.replace(/\s/g, "");

  if (!nif || !NIF_REGEX.test(nif)) {
    return NextResponse.json({ valid: false, error: "Formato de NIF inválido" }, { status: 400 });
  }

  // Verificar cache local (24h)
  const now = new Date();
  try {
    const cached = await (prisma as any).nifCache?.findUnique({ where: { nif } });
    if (cached && cached.expiresAt > now) {
      return NextResponse.json(
        cached.valid
          ? { valid: true, nome: cached.nome }
          : { valid: false, error: "NIF não encontrado. Verifique o número." },
      );
    }
  } catch { /* modelo ainda não migrado ou BD indisponível — avançar */ }

  // Proxy para digital.ao
  let rawBody: string;
  try {
    rawBody = await fetchDigitalAo(nif);
  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.message === "timeout";
    return NextResponse.json(
      {
        valid: false,
        error: isTimeout
          ? "O serviço demorou demasiado a responder. Tente novamente."
          : "Serviço de verificação indisponível. Tente mais tarde.",
      },
      { status: 503 },
    );
  }

  // Fazer parse da resposta
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { valid: false, error: "Erro ao verificar NIF. Tente novamente." },
      { status: 503 },
    );
  }

  // A API pode devolver "success" (correto) ou "sucess" (typo documentado)
  const isSuccess = json.success === true || json.sucess === true;

  // data pode ser objeto {nome, numero} ou array [{nome, numero}]
  const dataRaw  = json.data;
  const dataItem = Array.isArray(dataRaw) ? dataRaw[0] : dataRaw;
  const nome     = typeof dataItem?.nome === "string" ? dataItem.nome.trim() : "";

  const valid = isSuccess && nome !== "";

  // Guardar em cache (best-effort, só se o modelo existir)
  const expiresAt = new Date(Date.now() + CACHE_TTL_MS);
  try {
    await (prisma as any).nifCache?.upsert({
      where:  { nif },
      create: { nif, nome: nome || "", valid, expiresAt },
      update: { nome: nome || "", valid, expiresAt },
    });
  } catch { /* best-effort */ }

  if (!valid) {
    // Tentar extrair mensagem de erro da API
    const apiMsg =
      typeof json.message === "string" ? json.message :
      typeof (json.error as any)?.message === "string" ? (json.error as any).message :
      null;
    return NextResponse.json({
      valid: false,
      error: "NIF não encontrado. Verifique o número.",
    });
  }

  return NextResponse.json({ valid: true, nome });
}
