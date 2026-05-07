import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  const notif = await prisma.notification.findUnique({ where: { id } });
  if (!notif) return NextResponse.json({ error: "Não encontrada" }, { status: 404 });
  if (notif.userId !== session.user.id) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const updated = await prisma.notification.update({ where: { id }, data: { read: true } });
  return NextResponse.json(updated);
}
