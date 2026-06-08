import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { bio } = await req.json().catch(() => ({}));

  const existing = await prisma.copyTrader.findUnique({
    where: { userId: session.user.id },
  });

  if (existing) {
    return NextResponse.json(
      { error: "Candidatura já submetida.", status: existing.status },
      { status: 409 },
    );
  }

  const trader = await prisma.copyTrader.create({
    data: { userId: session.user.id, bio: bio ?? null, status: "pending" },
  });

  return NextResponse.json({ trader });
}
