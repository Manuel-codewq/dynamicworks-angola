import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/auditLog";

const MAX_BALANCE = 100_000_000;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }
  const { id } = await params;
  const { balance } = await req.json();
  const n = parseFloat(balance);
  if (!isFinite(n) || n < 0) return NextResponse.json({ error: "Saldo inválido" }, { status: 400 });
  if (n > MAX_BALANCE) return NextResponse.json({ error: `Saldo máximo: ${MAX_BALANCE.toLocaleString("pt-PT")} Kz` }, { status: 400 });

  const before = await prisma.user.findUnique({ where: { id }, select: { balance: true, name: true } });
  const user = await prisma.user.update({ where: { id }, data: { balance: n }, select: { id: true, balance: true } });

  await logAction(session.user.id, session.user.name ?? "Admin", "EDIT_BALANCE", id,
    `${before?.name ?? id}: ${Math.floor(before?.balance ?? 0).toLocaleString("pt-PT")} Kz → ${Math.floor(n).toLocaleString("pt-PT")} Kz`);

  await prisma.transaction.create({
    data: { userId: id, type: "adjustment", amount: n - (before?.balance ?? 0), status: "completed", reference: `Admin: ${session.user.name}` },
  });

  return NextResponse.json(user);
}
