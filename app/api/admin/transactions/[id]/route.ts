import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  sendDepositApprovedEmail, sendDepositRejectedEmail,
  sendWithdrawalApprovedEmail, sendWithdrawalRejectedEmail,
} from "@/lib/email";
import { createNotification } from "@/lib/notify";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { id } = await params;
  const { status } = await req.json();

  if (!["completed", "rejected"].includes(status)) {
    return NextResponse.json({ error: "Status inválido" }, { status: 400 });
  }

  const tx = await prisma.transaction.findUnique({ where: { id } });
  if (!tx) {
    return NextResponse.json({ error: "Transação não encontrada" }, { status: 404 });
  }
  if (tx.status !== "pending") {
    return NextResponse.json({ error: "Transação já processada" }, { status: 409 });
  }

  let updated;
  try {
    updated = await prisma.$transaction(async (dbTx) => {
      if (status === "completed") {
        if (tx.type === "deposit") {
          await dbTx.user.update({
            where: { id: tx.userId },
            data:  { balance: { increment: tx.amount } },
          });
        } else if (tx.type === "withdrawal") {
          // Debitar atomicamente: WHERE inclui condição de saldo — sem TOCTOU
          const deducted = await dbTx.user.updateMany({
            where: { id: tx.userId, balance: { gte: tx.amount } },
            data:  { balance: { decrement: tx.amount } },
          });
          if (deducted.count === 0) {
            throw Object.assign(new Error("INSUFFICIENT_BALANCE"), { code: "INSUFFICIENT_BALANCE" });
          }
        }
      }

      return dbTx.transaction.update({
        where:   { id },
        data:    { status },
        include: { user: { select: { name: true, email: true } } },
      });
    });
  } catch (err: any) {
    if (err?.code === "INSUFFICIENT_BALANCE") {
      return NextResponse.json({ error: "Saldo insuficiente para processar levantamento" }, { status: 422 });
    }
    console.error("[admin/transactions] erro ao processar:", err);
    return NextResponse.json({ error: "Erro interno ao processar transação" }, { status: 500 });
  }

  const amt = tx.amount.toLocaleString("pt-AO");
  const notifMap: Record<string, Record<string, { title: string; message: string }>> = {
    deposit: {
      completed: { title: "Depósito aprovado", message: `O seu depósito de ${amt} Kz foi aprovado e adicionado ao saldo.` },
      rejected:  { title: "Depósito rejeitado", message: `O seu depósito de ${amt} Kz foi rejeitado. Contacte o suporte.` },
    },
    withdrawal: {
      completed: { title: "Levantamento aprovado", message: `O seu levantamento de ${amt} Kz foi aprovado e será processado em breve.` },
      rejected:  { title: "Levantamento rejeitado", message: `O seu levantamento de ${amt} Kz foi rejeitado. Contacte o suporte.` },
    },
  };
  const notifData = notifMap[tx.type]?.[status];
  if (notifData) {
    await createNotification(tx.userId, `${tx.type}_${status}`, notifData.title, notifData.message);
  }

  // Send notification email — failure must not affect the API response
  try {
    const { name, email } = updated.user;
    if (status === "completed" && tx.type === "deposit") {
      await sendDepositApprovedEmail(email, name, tx.amount);
    } else if (status === "rejected" && tx.type === "deposit") {
      await sendDepositRejectedEmail(email, name, tx.amount);
    } else if (status === "completed" && tx.type === "withdrawal") {
      await sendWithdrawalApprovedEmail(email, name, tx.amount);
    } else if (status === "rejected" && tx.type === "withdrawal") {
      await sendWithdrawalRejectedEmail(email, name, tx.amount);
    }
  } catch (err) {
    console.error("[email] Falha ao enviar email de notificação:", err);
  }

  return NextResponse.json(updated);
}
