import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { onDepositApproved, onWithdrawalApproved, onWithdrawalRejected } from "@/lib/companyWallet";
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
  const { status } = await req.json();

  if (!["completed", "rejected"].includes(status)) {
    return NextResponse.json({ error: "Status inválido" }, { status: 400 });
  }

  const tx = await prisma.transaction.findUnique({ where: { id } });
  if (!tx) {
    return NextResponse.json({ error: "Transação não encontrada" }, { status: 404 });
  }
  // Verificação preliminar, só para responder depressa ao caso comum. A que
  // conta é a de dentro da transacção — ver o updateMany condicional abaixo.
  if (tx.status !== "pending") {
    return NextResponse.json({ error: "Transação já processada" }, { status: 409 });
  }

  // Comissão de referido: 2% do depósito creditado ao referidor
  const REFERRAL_PCT = 0.02;

  const cfg = await getSettings();

  let updated;
  try {
    updated = await prisma.$transaction(async (dbTx) => {
      // Fechadura contra a corrida com o cancelamento pelo utilizador
      // (app/api/transactions/[id]/cancel/route.ts): quem conseguir mudar o
      // estado a partir de "pending" ganha. Sem isto, o admin podia aprovar e
      // o utilizador cancelar ao mesmo tempo — a empresa pagava o levantamento
      // e devolvia o saldo. O findUnique lá em cima não protege disto porque
      // corre fora da transacção.
      const claimed = await dbTx.transaction.updateMany({
        where: { id, status: "pending" },
        data:  { status },
      });
      if (claimed.count === 0) {
        throw Object.assign(new Error("ALREADY_PROCESSED"), { code: "ALREADY_PROCESSED" });
      }

      if (status === "completed") {
        if (tx.type === "deposit") {
          await onDepositApproved(tx.id, tx.userId, tx.amount, dbTx);
          // Creditar saldo ao utilizador
          const depositor = await dbTx.user.update({
            where: { id: tx.userId },
            data:  { balance: { increment: tx.amount } },
            select: { referredBy: true },
          });

          // Bónus de depósito configurável pelo admin
          const prevDeposits = await dbTx.transaction.count({
            where: { userId: tx.userId, type: "deposit", status: "completed", id: { not: id } },
          });

          const isFirstDeposit = prevDeposits === 0;
          const bonusApplies   = cfg.depositBonusActive &&
            tx.amount >= cfg.depositBonusMinAoa &&
            (cfg.depositBonusType === "all" || isFirstDeposit);

          if (bonusApplies) {
            const bonus = Math.floor(tx.amount * (cfg.depositBonusPct / 100));
            const label = isFirstDeposit ? "boas-vindas" : "depósito";
            await dbTx.user.update({
              where: { id: tx.userId },
              data:  { balance: { increment: bonus } },
            });
            await dbTx.transaction.create({
              data: {
                userId:    tx.userId,
                type:      "bonus",
                amount:    bonus,
                status:    "completed",
                reference: `Bónus de ${label} ${cfg.depositBonusPct}%`,
              },
            });
            await dbTx.notification.create({
              data: {
                userId:  tx.userId,
                type:    "deposit_completed",
                title:   `Bónus de ${label}: +${bonus.toLocaleString("pt-PT")} Kz`,
                message: `Recebeste um bónus de ${cfg.depositBonusPct}% pelo teu depósito de ${Math.floor(tx.amount).toLocaleString("pt-PT")} Kz. O bónus foi adicionado ao teu saldo.`,
                read:    false,
              },
            });
          }

          // Comissão para o referidor
          if (depositor.referredBy) {
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
                  message: `Recebeste uma comissão de 2% pelo depósito de um utilizador que convidaste.`,
                  read:    false,
                },
              });
            }
          }
        }
        // levantamento aprovado: saldo já foi debitado na submissão
        if (tx.type === "withdrawal") {
          await onWithdrawalApproved(tx.id, tx.userId, tx.amount, dbTx);
        }
      } else if (status === "rejected" && tx.type === "withdrawal") {
        await onWithdrawalRejected(tx.id, tx.userId, tx.amount, dbTx);
        // Devolver saldo ao utilizador
        await dbTx.user.update({
          where: { id: tx.userId },
          data:  { balance: { increment: tx.amount } },
        });
      }

      // O estado já foi gravado pelo updateMany acima; aqui só se relê a linha
      // com o utilizador, para as notificações.
      return dbTx.transaction.findUniqueOrThrow({
        where:   { id },
        include: { user: { select: { name: true, email: true } } },
      });
    });
  } catch (err: any) {
    if (err?.code === "ALREADY_PROCESSED") {
      return NextResponse.json(
        { error: "Transação já processada — pode ter sido cancelada pelo utilizador." },
        { status: 409 },
      );
    }
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
