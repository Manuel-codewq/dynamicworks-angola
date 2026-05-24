import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const result    = searchParams.get("result");
  const asset     = searchParams.get("asset");
  const from      = searchParams.get("from");
  const to        = searchParams.get("to");
  const isDemo    = searchParams.get("isDemo");   // "true" | "false"
  const userQuery = searchParams.get("user");     // pesquisa por nome ou email
  const userId    = searchParams.get("userId");   // filtro por ID exacto
  const exportAll = searchParams.get("export") === "1"; // sem limite

  const where: any = {};
  if (result === "active") { where.status = "active"; }
  else if (result === "win" || result === "loss") { where.status = "closed"; where.result = result; }
  if (asset)             where.asset     = { contains: asset, mode: "insensitive" };
  if (from)              where.createdAt = { ...(where.createdAt ?? {}), gte: new Date(from) };
  if (to)                where.createdAt = { ...(where.createdAt ?? {}), lte: new Date(to) };
  if (isDemo === "true")  where.isDemo = true;
  if (isDemo === "false") where.isDemo = false;
  if (userId)            where.userId = userId;
  if (userQuery) {
    where.user = {
      OR: [
        { name:  { contains: userQuery, mode: "insensitive" } },
        { email: { contains: userQuery, mode: "insensitive" } },
      ],
    };
  }

  const trades = await prisma.trade.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: exportAll ? undefined : 500,
    include: { user: { select: { name: true, email: true } } },
  });

  return NextResponse.json(trades);
}
