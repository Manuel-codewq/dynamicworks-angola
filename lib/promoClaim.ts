import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notify";

/**
 * Crédito atómico de um PromoClaim pendente. updateMany condicional a
 * status:"pending" (+ userId, defesa redundante) é o guarda contra
 * duplo-resgate por corrida — se outro pedido já resgatou entretanto,
 * count fica 0 e nada é creditado de novo.
 */
export async function claimPromo(claim: { id: string; userId: string; amount: number }) {
  await prisma.$transaction(async (tx) => {
    const result = await tx.promoClaim.updateMany({
      where: { id: claim.id, userId: claim.userId, status: "pending" },
      data: { status: "claimed", claimedAt: new Date() },
    });
    if (result.count === 0) {
      throw new Error("ALREADY_CLAIMED");
    }

    await tx.user.update({
      where: { id: claim.userId },
      data: { balance: { increment: claim.amount } },
    });

    await tx.transaction.create({
      data: {
        userId: claim.userId,
        type: "promo",
        amount: claim.amount,
        status: "completed",
        reference: "Promoção — saldo de boas-vindas",
      },
    });
  });

  createNotification(
    claim.userId,
    "promo_claimed",
    `Recebeste ${claim.amount.toLocaleString("pt-PT")} Kz!`,
    "O saldo da promoção foi adicionado à tua conta real."
  ).catch(() => {});
}
