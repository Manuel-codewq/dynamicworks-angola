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

  // Admin não pode alterar o seu próprio role
  if (id === session.user.id) {
    return NextResponse.json({ error: "Não podes alterar o teu próprio role." }, { status: 403 });
  }

  const before = await prisma.user.findUnique({ where: { id }, select: { role: true, name: true } });
  if (!before) return NextResponse.json({ error: "Utilizador não encontrado" }, { status: 404 });

  // Proteger o último admin — deve existir sempre pelo menos 1
  if (before.role === "admin" && role === "user") {
    const adminCount = await prisma.user.count({ where: { role: "admin" } });
    if (adminCount <= 1) {
      return NextResponse.json({ error: "Não é possível remover o único administrador." }, { status: 409 });
    }
  }

  const user = await prisma.user.update({ where: { id }, data: { role }, select: { id: true, role: true } });

  await logAction(session.user.id, session.user.name ?? "Admin", "CHANGE_ROLE", id,
    `${before.name ?? id}: ${before.role} → ${role}`);

  return NextResponse.json(user);
}
