import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where:  { id: session.user.id },
    select: { indicatorPrefs: true },
  });
  return NextResponse.json({ indicatorPrefs: user?.indicatorPrefs ?? null });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { indicatorPrefs } = await req.json();
  if (!indicatorPrefs || typeof indicatorPrefs !== "object") {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data:  { indicatorPrefs },
  });
  return NextResponse.json({ ok: true });
}
