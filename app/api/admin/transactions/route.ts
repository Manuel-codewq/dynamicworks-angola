import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const type   = searchParams.get("type");
  const search = searchParams.get("search")?.trim();

  const where: any = {};

  if (status && ["pending", "completed", "rejected"].includes(status)) {
    where.status = status;
  }
  if (type && ["deposit", "withdrawal"].includes(type)) {
    where.type = type;
  }
  if (search) {
    where.user = {
      OR: [
        { name:  { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ],
    };
  }

  const transactions = await prisma.transaction.findMany({
    where,
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(transactions);
}
