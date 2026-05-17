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
  const { balance, type = "real" } = await req.json(); // type: "real" | "demo"
  const n = parseFloat(balance);
  if (!isFinite(n) || n < 0) return NextResponse.json({ error: "Saldo inválido" }, { status: 400 });
  if (n > MAX_BALANCE) return NextResponse.json({ error: `Saldo máximo: ${MAX_BALANCE.toLocaleString("pt-PT")} Kz` }, { status: 400 });

  const isDemo = type === "demo";
  const field  = isDemo ? "demoBalance" : "balance";

  const before = await prisma.user.findUnique({ where: { id }, select: { balance: true, demoBalance: true, name: true } });
  const user   = await prisma.user.update({ where: { id }, data: { [field]: n }, select: { id: true, balance: true, demoBalance: true } });

  const label = isDemo ? "SALDO DEMO" : "SALDO REAL";
  const prev  = isDemo ? (before?.demoBalance ?? 0) : (before?.balance ?? 0);
  await logAction(session.user.id, session.user.name ?? "Admin", "EDIT_BALANCE", id,
    `${before?.name ?? id} [${label}]: ${Math.floor(prev).toLocaleString("pt-PT")} Kz → ${Math.floor(n).toLocaleString("pt-PT")} Kz`);

  if (!isDemo) {
    await prisma.transaction.create({
      data: { userId: id, type: "adjustment", amount: n - prev, status: "completed", reference: `Admin: ${session.user.name}` },
    });
  }

  return NextResponse.json(user);
}
