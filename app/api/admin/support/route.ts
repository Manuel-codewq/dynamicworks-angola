import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status"); // open | in_progress | closed | all

  const tickets = await prisma.supportTicket.findMany({
    where:   status && status !== "all" ? { status } : undefined,
    orderBy: { updatedAt: "desc" },
    include: {
      user:     { select: { id: true, name: true, email: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
      _count:   { select: { messages: true } },
    },
  });

  return NextResponse.json(tickets);
}
