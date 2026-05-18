import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const alerts = await prisma.priceAlert.findMany({
    where:   { userId: session.user.id, triggered: false },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(alerts);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { asset, price, direction } = await req.json();
  if (!asset || !price || !["above", "below"].includes(direction)) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }
  if (typeof price !== "number" || price <= 0) {
    return NextResponse.json({ error: "Preço inválido" }, { status: 400 });
  }

  // Máximo 10 alertas activos por utilizador
  const count = await prisma.priceAlert.count({
    where: { userId: session.user.id, triggered: false },
  });
  if (count >= 10) {
    return NextResponse.json({ error: "Máximo de 10 alertas activos atingido." }, { status: 400 });
  }

  const alert = await prisma.priceAlert.create({
    data: { userId: session.user.id, asset, price, direction },
  });
  return NextResponse.json(alert, { status: 201 });
}
