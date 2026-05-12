import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Atualiza lastSeenAt para o utilizador autenticado.
// Chamado pelo HeartbeatTracker a cada 60s enquanto o browser está aberto.
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data:  { lastSeenAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
