import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }
  const { id } = await params;
  const { status } = await req.json();
  if (!["active", "blocked"].includes(status)) return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
  const user = await prisma.user.update({ where: { id }, data: { status }, select: { id: true, status: true } });
  return NextResponse.json(user);
}
