import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/webPush";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  // Verificar se há subscrições guardadas
  const subs = await prisma.pushSubscription.findMany({
    where: { userId: session.user.id },
  });

  if (!subs.length) {
    return NextResponse.json({
      error: "Sem subscrições guardadas. Activa as notificações primeiro.",
      subscriptions: 0,
    }, { status: 400 });
  }

  try {
    await sendPushToUser(session.user.id, {
      title: "✅ Notificações activas!",
      body:  "As tuas notificações de trading estão a funcionar correctamente.",
      url:   "/trade",
      tag:   "test",
    });
    return NextResponse.json({ success: true, subscriptions: subs.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, subscriptions: subs.length }, { status: 500 });
  }
}
