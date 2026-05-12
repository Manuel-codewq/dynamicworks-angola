import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || (session.user as any).role !== "admin")
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const sent = await prisma.notification.findMany({
    where: { type: "broadcast" },
    orderBy: { createdAt: "desc" },
    take: 50,
    distinct: ["title"],
    select: { id: true, title: true, message: true, createdAt: true },
  });
  return NextResponse.json(sent);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || (session.user as any).role !== "admin")
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { title, message, targetUserId } = await req.json();
  if (!title?.trim() || !message?.trim())
    return NextResponse.json({ error: "Título e mensagem obrigatórios" }, { status: 400 });

  if (targetUserId) {
    await prisma.notification.create({
      data: { userId: targetUserId, type: "admin", title: title.trim(), message: message.trim() },
    });
    await prisma.auditLog.create({
      data: { adminId: session.user.id, adminName: session.user.name ?? "Admin", action: "NOTIFY_USER", target: targetUserId, detail: title },
    });
    return NextResponse.json({ sent: 1 });
  }

  const users = await prisma.user.findMany({ where: { status: "active" }, select: { id: true } });
  await prisma.notification.createMany({
    data: users.map(u => ({ userId: u.id, type: "broadcast", title: title.trim(), message: message.trim() })),
  });
  await prisma.auditLog.create({
    data: { adminId: session.user.id, adminName: session.user.name ?? "Admin", action: "BROADCAST", target: "all_users", detail: title },
  });
  return NextResponse.json({ sent: users.length });
}
