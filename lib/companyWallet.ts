import { prisma } from "./prisma";

export const WITHDRAWAL_FEE = 0.05;

async function ensureWallet(dbTx: any) {
  return dbTx.companyWallet.upsert({
    where:  { id: "singleton" },
    create: { id: "singleton" },
    update: {},
  });
}

export async function onDepositApproved(txId: string, userId: string, amount: number, dbTx: any) {
  await ensureWallet(dbTx);
  await dbTx.companyWallet.update({
    where: { id: "singleton" },
    data:  { balance: { increment: amount } },
  });
  await dbTx.companyLedger.create({
    data: { type: "deposit_in", amount, txId, userId, description: `Depósito aprovado — ${amount.toLocaleString("pt-PT")} Kz` },
  });
}

export async function onWithdrawalPending(txId: string, userId: string, amount: number, dbTx: any) {
  await ensureWallet(dbTx);
  await dbTx.companyWallet.update({
    where: { id: "singleton" },
    data:  { pendingOut: { increment: amount } },
  });
  await dbTx.companyLedger.create({
    data: { type: "withdrawal_pending", amount, txId, userId, description: `Levantamento pendente — ${amount.toLocaleString("pt-PT")} Kz` },
  });
}

export async function onWithdrawalApproved(txId: string, userId: string, amount: number, dbTx: any) {
  await ensureWallet(dbTx);
  const fee    = Math.round(amount * WITHDRAWAL_FEE);
  const netOut = amount - fee;
  await dbTx.companyWallet.update({
    where: { id: "singleton" },
    data: {
      balance:      { decrement: netOut },
      pendingOut:   { decrement: amount },
      totalFees:    { increment: fee },
      totalPaidOut: { increment: netOut },
    },
  });
  await dbTx.companyLedger.createMany({
    data: [
      { type: "withdrawal_approved", amount: netOut, txId, userId, description: `Levantamento pago — ${netOut.toLocaleString("pt-PT")} Kz` },
      { type: "fee_earned",          amount: fee,    txId, userId, description: `Taxa 5% retida — ${fee.toLocaleString("pt-PT")} Kz` },
    ],
  });
}

export async function onWithdrawalRejected(txId: string, userId: string, amount: number, dbTx: any) {
  await ensureWallet(dbTx);
  await dbTx.companyWallet.update({
    where: { id: "singleton" },
    data:  { pendingOut: { decrement: amount } },
  });
  await dbTx.companyLedger.create({
    data: { type: "withdrawal_rejected", amount, txId, userId, description: `Levantamento rejeitado — devolvido ao utilizador` },
  });
}

/**
 * Cancelamento pelo próprio utilizador. O efeito contabilístico é igual ao da
 * rejeição — o dinheiro nunca saiu e volta ao saldo — mas fica com tipo e
 * descrição próprios para o histórico distinguir quem desistiu do pedido.
 */
export async function onWithdrawalCancelled(txId: string, userId: string, amount: number, dbTx: any) {
  await ensureWallet(dbTx);
  await dbTx.companyWallet.update({
    where: { id: "singleton" },
    data:  { pendingOut: { decrement: amount } },
  });
  await dbTx.companyLedger.create({
    data: { type: "withdrawal_cancelled", amount, txId, userId, description: `Levantamento cancelado pelo utilizador — devolvido ao saldo` },
  });
}

export async function getWallet() {
  const [depAgg, pendAgg, paidAgg] = await Promise.all([
    prisma.transaction.aggregate({ where: { type: "deposit",    status: "completed" }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { type: "withdrawal", status: "pending"   }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { type: "withdrawal", status: "completed" }, _sum: { amount: true } }),
  ]);

  const totalDeposited   = depAgg._sum.amount  ?? 0;
  const pendingOut       = pendAgg._sum.amount  ?? 0;
  const totalWithdrawn   = paidAgg._sum.amount  ?? 0;
  const totalFees        = Math.round(totalWithdrawn * WITHDRAWAL_FEE);
  const totalPaidOut     = totalWithdrawn - totalFees;
  const balance          = totalDeposited - totalWithdrawn;
  const available        = balance - pendingOut;

  return { balance, pendingOut, available, totalFees, totalPaidOut, totalDeposited };
}
