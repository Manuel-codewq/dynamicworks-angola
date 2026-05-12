import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VALID_ROLES   = ["user", "admin"] as const;
const MAX_BALANCE   = 100_000_000; // 100 milhões Kz — tecto operacional

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true, name: true, email: true, phone: true, province: true,
      balance: true, demoBalance: true, role: true, status: true,
      kycStatus: true, kycAttempts: true, createdAt: true,
      kycSubmission: { select: { id: true } },
      _count: { select: { trades: true, transactions: true } },
    },
  });

  return NextResponse.json(users);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { userId, action, value } = await req.json();

  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "userId inválido" }, { status: 400 });
  }

  // Confirmar que o utilizador alvo existe na BD
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!target) {
    return NextResponse.json({ error: "Utilizador não encontrado" }, { status: 404 });
  }

  if (action === "block") {
    await prisma.user.update({ where: { id: userId }, data: { status: "blocked" } });

  } else if (action === "unblock") {
    await prisma.user.update({ where: { id: userId }, data: { status: "active" } });

  } else if (action === "adjustBalance") {
    const newBalance = parseFloat(value);
    if (!isFinite(newBalance) || newBalance < 0) {
      return NextResponse.json({ error: "Saldo inválido" }, { status: 400 });
    }
    if (newBalance > MAX_BALANCE) {
      return NextResponse.json({ error: `Saldo máximo permitido: ${MAX_BALANCE.toLocaleString("pt-PT")} Kz` }, { status: 400 });
    }
    await prisma.user.update({ where: { id: userId }, data: { balance: newBalance } });

  } else if (action === "setRole") {
    if (!VALID_ROLES.includes(value as any)) {
      return NextResponse.json({ error: `Role inválido. Valores permitidos: ${VALID_ROLES.join(", ")}` }, { status: 400 });
    }
    // Impedir que admin se despromova acidentalmente
    if (userId === session.user.id && value !== "admin") {
      return NextResponse.json({ error: "Não pode alterar o seu próprio role" }, { status: 403 });
    }
    await prisma.user.update({ where: { id: userId }, data: { role: value } });

  } else {
    return NextResponse.json({ error: "Ação desconhecida" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
