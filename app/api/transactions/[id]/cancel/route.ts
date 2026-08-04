import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rateLimit";
import { onWithdrawalCancelled } from "@/lib/companyWallet";
import { createNotification } from "@/lib/notify";

/**
 * Cancelamento de um levantamento pendente pelo próprio utilizador, para quem
 * se cansa de esperar pela aprovação e prefere ter o dinheiro de volta no saldo.
 *
 * O saldo é debitado logo na submissão do pedido (app/api/transactions/route.ts),
 * por isso cancelar tem de o devolver.
 *
 * CRÍTICO — corrida com o admin: o admin pode estar a aprovar este mesmo pedido
 * neste instante. Se ambos passassem, o utilizador recebia o saldo de volta *e*
 * a empresa pagava o levantamento. A porta é o `updateMany` condicional abaixo:
 * quem conseguir mudar o estado a partir de "pending" ganha, o outro vê
 * `count === 0` e desiste. É por isso que o estado só é lido dentro da mesma
 * transacção que o altera.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const userId = session.user.id;

  if (!await checkRateLimit("transaction-cancel", userId, 10, 60 * 60_000)) {
    return NextResponse.json(
      { error: "Demasiados pedidos. Aguarda um pouco." },
      { status: 429 },
    );
  }

  const { id } = await params;

  let amount: number;
  try {
    amount = await prisma.$transaction(async (dbTx) => {
      // O WHERE é a fechadura: só transita quem encontrar o pedido ainda
      // pendente, deste utilizador e do tipo levantamento. Um depósito
      // pendente não se cancela — o dinheiro está do lado do banco, não nosso.
      const claimed = await dbTx.transaction.updateMany({
        where: { id, userId, type: "withdrawal", status: "pending" },
        data:  { status: "cancelled" },
      });
      if (claimed.count === 0) {
        throw Object.assign(new Error("NOT_CANCELLABLE"), { code: "NOT_CANCELLABLE" });
      }

      const tx = await dbTx.transaction.findUniqueOrThrow({
        where:  { id },
        select: { amount: true },
      });

      await dbTx.user.update({
        where: { id: userId },
        data:  { balance: { increment: tx.amount } },
      });
      await onWithdrawalCancelled(id, userId, tx.amount, dbTx);

      return tx.amount;
    });
  } catch (err: any) {
    if (err?.code === "NOT_CANCELLABLE") {
      // Serve tanto para "já foi processado" como para "não é teu": não vale a
      // pena distinguir, e não distinguir evita confirmar ids alheios.
      return NextResponse.json(
        { error: "Este levantamento já não pode ser cancelado — pode já ter sido processado." },
        { status: 409 },
      );
    }
    console.error("[transactions/cancel] erro:", err);
    return NextResponse.json({ error: "Erro interno ao cancelar" }, { status: 500 });
  }

  // Fora da transacção: falhar a notificar não pode desfazer o cancelamento.
  createNotification(
    userId,
    "withdrawal_cancelled",
    "Levantamento cancelado",
    `Cancelaste o teu levantamento de ${Math.floor(amount).toLocaleString("pt-PT")} Kz. O valor voltou ao teu saldo.`,
  ).catch(() => {});

  return NextResponse.json({ ok: true, refunded: amount });
}
