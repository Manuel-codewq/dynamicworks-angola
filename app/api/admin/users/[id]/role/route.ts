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
  const { role } = await req.json();
  if (!["user", "admin"].includes(role)) return NextResponse.json({ error: "Role inválido" }, { status: 400 });

  const before = await prisma.user.findUnique({ where: { id }, select: { role: true, name: true } });
  const user = await prisma.user.update({ where: { id }, data: { role }, select: { id: true, role: true } });

  await logAction(session.user.id, session.user.name ?? "Admin", "CHANGE_ROLE", id,
    `${before?.name ?? id}: ${before?.role} → ${role}`);

  return NextResponse.json(user);
}
