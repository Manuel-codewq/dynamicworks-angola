import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const result = searchParams.get("result");   // win | loss | active
  const asset  = searchParams.get("asset");
  const from   = searchParams.get("from");
  const to     = searchParams.get("to");

  const where: any = {};
  if (result === "active") { where.status = "active"; }
  else if (result === "win" || result === "loss") { where.status = "closed"; where.result = result; }
  if (asset) where.asset = { contains: asset, mode: "insensitive" };
  if (from)  where.createdAt = { ...(where.createdAt ?? {}), gte: new Date(from) };
  if (to)    where.createdAt = { ...(where.createdAt ?? {}), lte: new Date(to) };

  const trades = await prisma.trade.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 500,
    include: { user: { select: { name: true, email: true } } },
  });

  return NextResponse.json(trades);
}
