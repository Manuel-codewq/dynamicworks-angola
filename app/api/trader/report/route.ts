import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/getClientIp";

function isTrader(role: string) { return role === "trader" || role === "admin"; }
function todayStr() { return new Date().toISOString().slice(0, 10); }

export async function POST(req: NextRequest) {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id || !isTrader(user.role))
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  if (!await checkRateLimit("trader_report", getClientIp(req), 20, 60_000))
    return NextResponse.json({ error: "Demasiados pedidos" }, { status: 429 });

  const body = await req.json();
  const { operacoes, lucro, paresNegociados, estrategia, observacoes, planoAmanha, imagemProva } = body;

  if (!observacoes || typeof observacoes !== "string" || observacoes.trim().length < 5)
    return NextResponse.json({ error: "Descreve as tuas observações (mínimo 5 caracteres)" }, { status: 400 });

  const date = todayStr();
  const report = await prisma.traderReport.upsert({
    where:  { userId_date: { userId: user.id, date } },
    create: { userId: user.id, date, operacoes: operacoes ? Number(operacoes) : null, lucro: lucro ? Number(lucro) : null, paresNegociados: paresNegociados?.trim() || null, estrategia: estrategia?.trim() || null, observacoes: observacoes.trim(), planoAmanha: planoAmanha?.trim() || null, imagemProva: imagemProva || null },
    update: { operacoes: operacoes ? Number(operacoes) : null, lucro: lucro ? Number(lucro) : null, paresNegociados: paresNegociados?.trim() || null, estrategia: estrategia?.trim() || null, observacoes: observacoes.trim(), planoAmanha: planoAmanha?.trim() || null, imagemProva: imagemProva || null },
  });

  return NextResponse.json({ ok: true, report });
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id || !isTrader(user.role))
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") || "30"), 90);
  const reports = await prisma.traderReport.findMany({
    where: { userId: user.id }, orderBy: { date: "desc" }, take: limit,
  });
  return NextResponse.json({ reports });
}
