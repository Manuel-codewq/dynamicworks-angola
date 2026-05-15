import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { balance: true, demoBalance: true, isDemo: true },
  });

  if (!user) return NextResponse.json({ error: "Utilizador não encontrado" }, { status: 404 });

  return NextResponse.json(user);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { isDemo } = await req.json();

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: { isDemo: Boolean(isDemo) },
    select: { balance: true, demoBalance: true, isDemo: true },
  });

  return NextResponse.json(user);
}

