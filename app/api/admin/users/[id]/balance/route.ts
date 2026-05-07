import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }
  const { id } = await params;
  const { balance } = await req.json();
  const n = parseFloat(balance);
  if (!isFinite(n) || n < 0) return NextResponse.json({ error: "Saldo inválido" }, { status: 400 });
  const user = await prisma.user.update({ where: { id }, data: { balance: n }, select: { id: true, balance: true } });
  return NextResponse.json(user);
}
