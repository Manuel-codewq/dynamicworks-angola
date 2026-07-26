import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { claimPromo } from "@/lib/promoClaim";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessão necessária" }, { status: 401 });
  }

  const { token } = await params;

  const claim = await prisma.promoClaim.findUnique({ where: { token } });
  if (!claim) {
    return NextResponse.json({ error: "Link inválido" }, { status: 404 });
  }

  // Dono do link tem de ser o utilizador autenticado — impede resgatar o
  // link de outra pessoa mesmo que o intercepte (ex: partilhado por engano).
  if (claim.userId !== session.user.id) {
    return NextResponse.json({ error: "Este link não pertence à tua conta" }, { status: 403 });
  }

  if (claim.status === "claimed") {
    return NextResponse.json({ error: "Este link já foi resgatado" }, { status: 409 });
  }

  if (claim.status === "expired" || claim.expiresAt < new Date()) {
    if (claim.status !== "expired") {
      await prisma.promoClaim.update({ where: { id: claim.id }, data: { status: "expired" } }).catch(() => {});
    }
    return NextResponse.json({ error: "Este link expirou" }, { status: 410 });
  }

  try {
    await claimPromo(claim);
  } catch (err: any) {
    if (err.message === "ALREADY_CLAIMED") {
      return NextResponse.json({ error: "Este link já foi resgatado" }, { status: 409 });
    }
    console.error("[promo/claim] erro ao processar resgate:", err);
    return NextResponse.json({ error: "Erro interno ao processar o resgate" }, { status: 500 });
  }

  return NextResponse.json({ amount: claim.amount });
}
