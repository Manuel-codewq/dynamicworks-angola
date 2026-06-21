import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || (session.user as any).role !== "admin")
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const { searchParams } = req.nextUrl;
  const date      = searchParams.get("date");      // filtrar por data
  const userId    = searchParams.get("userId");    // filtrar por formador
  const limit     = Math.min(Number(searchParams.get("limit") || "60"), 200);

  const reports = await prisma.formadorReport.findMany({
    where: {
      ...(date   ? { date }              : {}),
      ...(userId ? { userId }            : {}),
      user: { role: { in: ["formador", "admin"] } },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take:    limit,
    include: {
      user: { select: { id: true, name: true, email: true, avatar: true } },
    },
  });

  // Lista de formadores para o filtro
  const formadores = await prisma.user.findMany({
    where:  { role: "formador" },
    select: { id: true, name: true, email: true, avatar: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ reports, formadores });
}
