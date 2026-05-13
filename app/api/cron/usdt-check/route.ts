import { NextRequest, NextResponse } from "next/server";
import { processIncomingUsdt } from "@/lib/usdt";

// Cron de verificação Trongrid. Chama-se de um job externo (Vercel Cron, etc).
// Protegido pelo header `Authorization: Bearer ${CRON_SECRET}` ou query `?token=`.
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  return handle();
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  return handle();
}

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const token = req.nextUrl.searchParams.get("token");
  return token === secret;
}

async function handle() {
  try {
    const result = await processIncomingUsdt();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/usdt-check] erro:", err);
    return NextResponse.json({ ok: false, error: "Erro interno" }, { status: 500 });
  }
}
