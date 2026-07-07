import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const [users, approvedDepositors] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, email: true, phone: true, province: true,
        balance: true, demoBalance: true, role: true, status: true,
        kycStatus: true, kycAttempts: true, createdAt: true,
        kycSubmission: { select: { id: true } },
        _count: { select: { trades: true, transactions: true } },
      },
    }),
    // IDs de utilizadores com pelo menos 1 depósito aprovado
    prisma.transaction.findMany({
      where:    { type: "deposit", status: "completed" },
      select:   { userId: true },
      distinct: ["userId"],
    }).then(r => new Set(r.map(x => x.userId))),
  ]);

  const result = users.map(u => ({
    ...u,
    // Suspeito: tem saldo real > 0 mas nunca teve depósito aprovado
    suspicious: u.balance > 0 && !approvedDepositors.has(u.id) && u.role !== "admin",
  }));

  return NextResponse.json(result);
}

// Nota: block/unblock, ajuste de saldo e mudança de role já não são feitos aqui.
// Usar /api/admin/users/[id]/status, /balance e /role — têm rate limit, tecto
// diário, motivo obrigatório, log de auditoria e protecção do último admin.
