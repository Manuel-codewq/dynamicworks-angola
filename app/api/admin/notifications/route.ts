import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/webPush";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || (session.user as any).role !== "admin")
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  // Buscar as últimas 50 notificações broadcast, sem distinct problemático
  const all = await prisma.notification.findMany({
    where: { type: "broadcast" },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, title: true, message: true, createdAt: true },
  });

  // Deduplicar por título no lado do servidor
  const seen = new Set<string>();
  const sent = all.filter(n => {
    if (seen.has(n.title)) return false;
    seen.add(n.title);
    return true;
  }).slice(0, 50);

  return NextResponse.json(sent);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || (session.user as any).role !== "admin")
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });

  const { title, message, targetUserId } = body;
  if (!title?.trim() || !message?.trim())
    return NextResponse.json({ error: "Título e mensagem obrigatórios" }, { status: 400 });

  try {
    if (targetUserId) {
      await prisma.notification.create({
        data: { userId: targetUserId, type: "admin", title: title.trim(), message: message.trim() },
      });
      // Push para o utilizador específico
      sendPushToUser(targetUserId, {
        title:   title.trim(),
        body:    message.trim(),
        url:     "/trade",
        tag:     "admin",
      }).catch(() => {});
      await (prisma as any).auditLog.create({
        data: { adminId: session.user.id, adminName: session.user.name ?? "Admin", action: "NOTIFY_USER", target: targetUserId, detail: title },
      });
      return NextResponse.json({ sent: 1 });
    }

    const users = await prisma.user.findMany({ where: { status: "active" }, select: { id: true } });
    if (users.length > 0) {
      await prisma.notification.createMany({
        data: users.map(u => ({ userId: u.id, type: "broadcast", title: title.trim(), message: message.trim() })),
      });
      // Push para todos em paralelo (sem await para não bloquear a resposta)
      Promise.allSettled(
        users.map(u => sendPushToUser(u.id, {
          title: title.trim(),
          body:  message.trim(),
          url:   "/trade",
          tag:   "broadcast",
        }))
      ).catch(() => {});
    }
    await (prisma as any).auditLog.create({
      data: { adminId: session.user.id, adminName: session.user.name ?? "Admin", action: "BROADCAST", target: "all_users", detail: title },
    });
    return NextResponse.json({ sent: users.length });
  } catch (err: any) {
    console.error("[notifications/POST]", err?.message ?? err);
    return NextResponse.json({ error: "Erro interno. Tente novamente." }, { status: 500 });
  }
}
