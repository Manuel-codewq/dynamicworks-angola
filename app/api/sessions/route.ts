import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const currentSessionId = (session.user as any).sessionId as string | undefined;

  const sessions = await prisma.userSession.findMany({
    where:   { userId: session.user.id, isActive: true },
    orderBy: { lastActiveAt: "desc" },
    take:    20,
  });

  return NextResponse.json(
    sessions.map(s => ({
      id:           s.id,
      device:       s.device ?? "Dispositivo desconhecido",
      ip:           s.ip ?? "—",
      createdAt:    s.createdAt,
      lastActiveAt: s.lastActiveAt,
      isCurrent:    s.id === currentSessionId,
    })),
  );
}

// Revogar todas as sessões excepto a actual
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const currentSessionId = (session.user as any).sessionId as string | undefined;

  await prisma.userSession.updateMany({
    where: {
      userId:   session.user.id,
      isActive: true,
      id:       { not: currentSessionId ?? "" },
    },
    data: { isActive: false },
  });

  return NextResponse.json({ success: true });
}
