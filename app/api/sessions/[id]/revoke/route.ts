import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;

  const userSession = await prisma.userSession.findUnique({ where: { id } });
  if (!userSession || userSession.userId !== session.user.id) {
    return NextResponse.json({ error: "Sessão não encontrada" }, { status: 404 });
  }

  await prisma.userSession.update({
    where: { id },
    data:  { isActive: false },
  });

  return NextResponse.json({ success: true });
}
