import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/getClientIp";
import https from "node:https";

const NIF_REGEX    = /^[A-Z0-9]{9,14}$/i;
const CACHE_TTL_MS = 24 * 60 * 60_000; // 24 horas

function fetchSme(bi: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = `https://sme.gov.ao/actions/bi.ajcall.php?bi=${encodeURIComponent(bi)}`;

    const req = https.get(url, {
      headers: {
        "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
        "Referer":         "https://sme.gov.ao/ao/utentes/novo/",
        "Accept":          "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest",
      },
      timeout: 12000,
    }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk: string) => { body += chunk; });
      res.on("end", () => resolve(body));
    });

    req.on("timeout", () => { req.destroy(new Error("timeout")); });
    req.on("error",   (err) => { reject(err); });
  });
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);

  if (!await checkRateLimit("nif_lookup", ip, 10, 5 * 60_000)) {
    return NextResponse.json(
      { valid: false, error: "Demasiados pedidos. Tente mais tarde." },
      { status: 429 },
    );
  }

  const nif = req.nextUrl.searchParams.get("nif")?.replace(/\s/g, "");

  if (!nif || !NIF_REGEX.test(nif)) {
    return NextResponse.json({ valid: false, error: "Formato de BI inválido" }, { status: 400 });
  }

  // Cache local (24h)
  const now = new Date();
  try {
    const cached = await (prisma as any).nifCache?.findUnique({ where: { nif } });
    if (cached && cached.expiresAt > now) {
      return NextResponse.json(
        cached.valid
          ? { valid: true, nome: cached.nome }
          : { valid: false, error: "BI não encontrado. Verifique o número." },
      );
    }
  } catch { /* cache indisponível — avançar */ }

  // Chamar API da SME
  let rawBody: string;
  try {
    rawBody = await fetchSme(nif);
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

  let json: Record<string, unknown>;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { valid: false, error: "Erro ao verificar BI. Tente novamente." },
      { status: 503 },
    );
  }

  const isSuccess = json.sucess === true || json.success === true;
  const data      = json.data as Record<string, unknown> | undefined;
  const nome      = typeof data?.nome_completo === "string" ? data.nome_completo.trim()
                  : typeof data?.nome          === "string" ? data.nome.trim()
                  : "";

  const valid = isSuccess && nome !== "";

  // Guardar em cache
  const expiresAt = new Date(Date.now() + CACHE_TTL_MS);
  try {
    await (prisma as any).nifCache?.upsert({
      where:  { nif },
      create: { nif, nome: nome || "", valid, expiresAt },
      update: { nome: nome || "", valid, expiresAt },
    });
  } catch { /* best-effort */ }

  if (!valid) {
    return NextResponse.json({ valid: false, error: "BI não encontrado. Verifique o número." });
  }

  return NextResponse.json({
    valid:         true,
    nome,
    dataNasc:      typeof data?.data_nasc         === "string" ? data.data_nasc         : undefined,
    genero:        typeof data?.genero             === "string" ? data.genero             : undefined,
    naturalidade:  typeof data?.naturalidade       === "string" ? data.naturalidade       : undefined,
    nacionalidade: typeof data?.nacionalidade_nome === "string" ? data.nacionalidade_nome : undefined,
  });
}
