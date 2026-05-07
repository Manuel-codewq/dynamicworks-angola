import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where:  { id: session.user.id },
    select: {
      id: true, name: true, email: true, phone: true,
      province: true, biNumber: true, kycStatus: true,
      role: true, status: true, createdAt: true,
      balance: true, demoBalance: true,
    },
  });

  if (!user) return NextResponse.json({ error: "Utilizador não encontrado" }, { status: 404 });
  return NextResponse.json(user);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { name, phone, province } = await req.json();

  if (!name || String(name).trim().length < 3) {
    return NextResponse.json({ error: "Nome deve ter pelo menos 3 caracteres" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data:  { name: String(name).trim(), phone: phone ?? null, province: province ?? null },
    select: { id: true, name: true, phone: true, province: true },
  });

  return NextResponse.json(updated);
}
