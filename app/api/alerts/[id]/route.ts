import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/webPush";

// DELETE — remover alerta
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const { id } = await params;
  await prisma.priceAlert.deleteMany({ where: { id, userId: session.user.id } });
  return NextResponse.json({ ok: true });
}

// POST — disparar alerta (chamado pelo cliente quando preço cruza o alvo)
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const { id } = await params;

  const alert = await prisma.priceAlert.findFirst({
    where: { id, userId: session.user.id, triggered: false },
  });
  if (!alert) return NextResponse.json({ ok: true }); // já disparado ou não existe

  await prisma.priceAlert.update({ where: { id }, data: { triggered: true } });

  const dirLabel = alert.direction === "above" ? "atingiu ▲" : "desceu abaixo de ▼";
  sendPushToUser(session.user.id, {
    title: `Alerta de preço — ${alert.asset}`,
    body:  `${alert.asset} ${dirLabel} ${alert.price}`,
    url:   "/trade",
    tag:   `price-alert-${id}`,
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
