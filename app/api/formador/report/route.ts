import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/getClientIp";

function isFormador(role: string) {
  return role === "formador" || role === "admin";
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// Submeter ou actualizar relatório do dia
export async function POST(req: NextRequest) {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id || !isFormador(user.role))
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const ip = getClientIp(req);
  if (!await checkRateLimit("formador_report", ip, 20, 60_000))
    return NextResponse.json({ error: "Demasiados pedidos" }, { status: 429 });

  const body = await req.json();
  const { feito, videoPublicado, videoTitulo, reacoes, duvidasMembros, planoAmanha } = body;

  if (!feito || typeof feito !== "string" || feito.trim().length < 5)
    return NextResponse.json({ error: "Descreve o que fizeste hoje (mínimo 5 caracteres)" }, { status: 400 });

  const date = todayStr();

  const report = await prisma.formadorReport.upsert({
    where:  { userId_date: { userId: user.id, date } },
    create: {
      userId:        user.id,
      date,
      feito:         feito.trim(),
      videoPublicado: !!videoPublicado,
      videoTitulo:   videoTitulo?.trim() || null,
      reacoes:       reacoes ? Number(reacoes) : null,
      duvidasMembros: duvidasMembros?.trim() || null,
      planoAmanha:   planoAmanha?.trim() || null,
    },
    update: {
      feito:         feito.trim(),
      videoPublicado: !!videoPublicado,
      videoTitulo:   videoTitulo?.trim() || null,
      reacoes:       reacoes ? Number(reacoes) : null,
      duvidasMembros: duvidasMembros?.trim() || null,
      planoAmanha:   planoAmanha?.trim() || null,
    },
  });

  return NextResponse.json({ ok: true, report });
}

// Ver os meus relatórios
export async function GET(req: NextRequest) {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id || !isFormador(user.role))
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { searchParams } = req.nextUrl;
  const limit = Math.min(Number(searchParams.get("limit") || "30"), 90);

  const reports = await prisma.formadorReport.findMany({
    where:   { userId: user.id },
    orderBy: { date: "desc" },
    take:    limit,
  });

  return NextResponse.json({ reports });
}
