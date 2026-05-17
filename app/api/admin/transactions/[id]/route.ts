import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  sendDepositApprovedEmail, sendDepositRejectedEmail,
  sendWithdrawalApprovedEmail, sendWithdrawalRejectedEmail,
} from "@/lib/email";
import { createNotification } from "@/lib/notify";
import { sendPushToUser } from "@/lib/webPush";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { id } = await params;
  const { status, usdtTxid } = await req.json();

  if (!["completed", "rejected"].includes(status)) {
    return NextResponse.json({ error: "Status inválido" }, { status: 400 });
  }

  // Para saques USDT exige-se o TXID da transferência enviada manualmente
  if (status === "completed" && typeof usdtTxid === "string" && usdtTxid.trim()) {
    if (!/^[A-Fa-f0-9]{64}$/.test(usdtTxid.trim())) {
      return NextResponse.json({ error: "TXID inválido (esperado hash de 64 chars)" }, { status: 400 });
    }
  }

  const tx = await prisma.transaction.findUnique({ where: { id } });
  if (!tx) {
    return NextResponse.json({ error: "Transação não encontrada" }, { status: 404 });
  }
  if (tx.status !== "pending") {
    return NextResponse.json({ error: "Transação já processada" }, { status: 409 });
  }

  // Comissão de referido: 2% do depósito creditado ao referidor
  const REFERRAL_PCT = 0.02;

  let updated;
  try {
    updated = await prisma.$transaction(async (dbTx) => {
      if (status === "completed") {
        if (tx.type === "deposit") {
          // Creditar saldo ao utilizador
          const depositor = await dbTx.user.update({
            where: { id: tx.userId },
            data:  { balance: { increment: tx.amount } },
            select: { referredBy: true },
          });

          // Comissão para o referidor (apenas no primeiro depósito aprovado)
          if (depositor.referredBy) {
            const prevDeposits = await dbTx.transaction.count({
              where: { userId: tx.userId, type: "deposit", status: "completed", id: { not: id } },
            });
            if (prevDeposits === 0) {
              const commission = Math.floor(tx.amount * REFERRAL_PCT);
              if (commission > 0) {
                await dbTx.user.update({
                  where: { id: depositor.referredBy },
                  data:  { balance: { increment: commission }, referralEarnings: { increment: commission } },
                });
                await dbTx.notification.create({
                  data: {
                    userId:  depositor.referredBy,
                    type:    "referral_commission",
                    title:   `Comissão de referido: +${commission.toLocaleString("pt-PT")} Kz`,
                    message: `Recebeste uma comissão de 5% pelo depósito de um utilizador que convidaste.`,
                    read:    false,
                  },
                });
              }
            }
          }
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
        data:    {
          status,
          ...(status === "completed" && typeof usdtTxid === "string" && usdtTxid.trim()
            ? { usdtTxid: usdtTxid.trim() }
            : {}),
        },
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

  const amt = tx.amount.toLocaleString("pt-PT");
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

  // Email + Push — falha não afecta a resposta da API
  try {
    const { name, email } = updated.user;
    const amt = Math.floor(tx.amount).toLocaleString("pt-PT");

    if (status === "completed" && tx.type === "deposit") {
      sendDepositApprovedEmail(email, name, tx.amount).catch(() => {});
      sendPushToUser(tx.userId, {
        title: `Depósito aprovado — +${amt} Kz`,
        body:  "O teu depósito foi aprovado e adicionado ao saldo real.",
        url:   "/wallet", tag: "deposit",
      }).catch(() => {});
    } else if (status === "rejected" && tx.type === "deposit") {
      sendDepositRejectedEmail(email, name, tx.amount).catch(() => {});
      sendPushToUser(tx.userId, {
        title: "Depósito não aprovado",
        body:  "O teu pedido de depósito foi rejeitado. Contacta o suporte.",
        url:   "/wallet", tag: "deposit",
      }).catch(() => {});
    } else if (status === "completed" && tx.type === "withdrawal") {
      sendWithdrawalApprovedEmail(email, name, tx.amount).catch(() => {});
      sendPushToUser(tx.userId, {
        title: `Levantamento aprovado — ${amt} Kz`,
        body:  "O teu levantamento foi aprovado e está a ser processado.",
        url:   "/wallet", tag: "withdrawal",
      }).catch(() => {});
    } else if (status === "rejected" && tx.type === "withdrawal") {
      sendWithdrawalRejectedEmail(email, name, tx.amount).catch(() => {});
      sendPushToUser(tx.userId, {
        title: "Levantamento não aprovado",
        body:  "O teu pedido de levantamento foi rejeitado. Contacta o suporte.",
        url:   "/wallet", tag: "withdrawal",
      }).catch(() => {});
    }
  } catch (err) {
    console.error("[notif] Falha ao enviar notificação:", err);
  }

  return NextResponse.json(updated);
}
