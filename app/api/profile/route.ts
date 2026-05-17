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
      balance: true, demoBalance: true, avatar: true,
      twoFactorEnabled: true, twoFactorMethod: true,
    },
  });

  if (!user) return NextResponse.json({ error: "Utilizador não encontrado" }, { status: 404 });
  return NextResponse.json(user);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { name, phone, province, avatar } = await req.json();

  if (!name || String(name).trim().length < 3) {
    return NextResponse.json({ error: "Nome deve ter pelo menos 3 caracteres" }, { status: 400 });
  }

  // Validate avatar URL if provided (must be Cloudinary or empty string to clear)
  if (avatar !== undefined && avatar !== null && avatar !== "") {
    if (typeof avatar !== "string" || !avatar.startsWith("https://res.cloudinary.com/")) {
      return NextResponse.json({ error: "URL de avatar inválida." }, { status: 400 });
    }
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data:  {
      name:     String(name).trim(),
      phone:    phone ?? null,
      province: province ?? null,
      ...(avatar !== undefined ? { avatar: avatar || null } : {}),
    },
    select: { id: true, name: true, phone: true, province: true, avatar: true },
  });

  return NextResponse.json(updated);
}
