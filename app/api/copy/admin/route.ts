import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  return user?.role === "admin" ? session : null;
}

// GET — listar candidaturas
export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const status = new URL(req.url).searchParams.get("status") ?? "pending";
  const traders = await prisma.copyTrader.findMany({
    where: status === "all" ? undefined : { status },
    include: { user: { select: { id: true, name: true, email: true, avatar: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ traders });
}

// PATCH — aprovar / rejeitar
export async function PATCH(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const { traderId, action, commission } = await req.json().catch(() => ({}));
  if (!traderId || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
  }

  const data: any = { status: action === "approve" ? "approved" : "rejected" };
  if (commission != null) data.commission = Number(commission);

  const trader = await prisma.copyTrader.update({
    where: { id: traderId },
    data,
    include: { user: { select: { name: true, email: true } } },
  });

  await prisma.auditLog.create({
    data: {
      adminId: session.user!.id as string,
      adminName: (session.user!.name ?? (session.user as any).email ?? "Admin") as string,
      action: `copy_trader_${action}`,
      target: trader.user.email,
      detail: `Commission: ${trader.commission}`,
    },
  });

  return NextResponse.json({ trader });
}
