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
  const page   = Math.max(1, parseInt(searchParams.get("page")  ?? "1"));
  const limit  = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") ?? "50")));
  const skip   = (page - 1) * limit;

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

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.transaction.count({ where }),
  ]);

  return NextResponse.json({ transactions, total, page, totalPages: Math.ceil(total / limit) });
}
