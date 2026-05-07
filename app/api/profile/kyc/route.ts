import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { biNumber } = await req.json();
  const bi = String(biNumber ?? "").trim();

  if (bi.length < 8 || bi.length > 14) {
    return NextResponse.json({ error: "Número do BI deve ter entre 8 e 14 caracteres" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data:  { biNumber: bi, kycStatus: "pending" },
  });

  return NextResponse.json({ ok: true });
}
