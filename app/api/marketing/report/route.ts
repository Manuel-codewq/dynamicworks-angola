import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/getClientIp";

function isMarketing(role: string) { return role === "marketing" || role === "admin"; }
function todayStr() { return new Date().toISOString().slice(0, 10); }

export async function POST(req: NextRequest) {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id || !isMarketing(user.role))
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  if (!await checkRateLimit("marketing_report", getClientIp(req), 20, 60_000))
    return NextResponse.json({ error: "Demasiados pedidos" }, { status: 429 });

  const body = await req.json();
  const { conteudoCriado, plataforma, visualizacoes, leadsGerados, proximoConteudo, observacoes, imagemProva } = body;

  if (!conteudoCriado || typeof conteudoCriado !== "string" || conteudoCriado.trim().length < 5)
    return NextResponse.json({ error: "Descreve o conteúdo criado (mínimo 5 caracteres)" }, { status: 400 });

  const date = todayStr();
  const report = await prisma.marketingReport.upsert({
    where:  { userId_date: { userId: user.id, date } },
    create: { userId: user.id, date, conteudoCriado: conteudoCriado.trim(), plataforma: plataforma?.trim() || null, visualizacoes: visualizacoes ? Number(visualizacoes) : null, leadsGerados: leadsGerados ? Number(leadsGerados) : null, proximoConteudo: proximoConteudo?.trim() || null, observacoes: observacoes?.trim() || null, imagemProva: imagemProva || null },
    update: { conteudoCriado: conteudoCriado.trim(), plataforma: plataforma?.trim() || null, visualizacoes: visualizacoes ? Number(visualizacoes) : null, leadsGerados: leadsGerados ? Number(leadsGerados) : null, proximoConteudo: proximoConteudo?.trim() || null, observacoes: observacoes?.trim() || null, imagemProva: imagemProva || null },
  });

  return NextResponse.json({ ok: true, report });
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id || !isMarketing(user.role))
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") || "30"), 90);
  const reports = await prisma.marketingReport.findMany({
    where: { userId: user.id }, orderBy: { date: "desc" }, take: limit,
  });
  return NextResponse.json({ reports });
}
