import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where:  { id: session.user.id },
    select: { twoFactorEnabled: true, twoFactorDeadline: true },
  });
  if (!user) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  const deadline = user.twoFactorDeadline;
  const now      = new Date();
  const daysLeft = deadline ? Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / (24 * 3600 * 1000))) : null;

  return NextResponse.json({
    enabled:  user.twoFactorEnabled,
    deadline: deadline ? deadline.toISOString() : null,
    daysLeft,
    expired:  !!deadline && deadline < now,
  });
}
