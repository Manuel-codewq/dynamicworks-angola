import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/auditLog";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }
  const { id } = await params;
  const { status } = await req.json();
  if (!["active", "blocked"].includes(status)) return NextResponse.json({ error: "Estado inválido" }, { status: 400 });

  const before = await prisma.user.findUnique({ where: { id }, select: { name: true } });
  const user = await prisma.user.update({ where: { id }, data: { status }, select: { id: true, status: true } });

  await logAction(session.user.id, session.user.name ?? "Admin",
    status === "blocked" ? "BLOCK_USER" : "UNBLOCK_USER", id, before?.name ?? id);

  return NextResponse.json(user);
}
