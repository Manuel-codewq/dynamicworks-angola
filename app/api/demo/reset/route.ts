import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DEMO_RESET_AMOUNT = 10000;

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data:  { demoBalance: DEMO_RESET_AMOUNT },
  });

  return NextResponse.json({ ok: true, demoBalance: DEMO_RESET_AMOUNT });
}
