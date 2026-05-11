import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { id } = await params;
  const ticket = await prisma.supportTicket.findUnique({
    where:   { id },
    include: {
      user:     { select: { id: true, name: true, email: true } },
      messages: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!ticket) return NextResponse.json({ error: "Ticket não encontrado." }, { status: 404 });
  return NextResponse.json(ticket);
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { id } = await params;
  const { body } = await req.json();

  if (!body || String(body).trim().length < 2) {
    return NextResponse.json({ error: "Resposta demasiado curta." }, { status: 400 });
  }

  const ticket = await prisma.supportTicket.findUnique({ where: { id } });
  if (!ticket) return NextResponse.json({ error: "Ticket não encontrado." }, { status: 404 });

  const [message] = await prisma.$transaction([
    prisma.supportMessage.create({
      data: { ticketId: id, body: String(body).slice(0, 2000).trim(), isAdmin: true },
    }),
    prisma.supportTicket.update({
      where: { id },
      data:  { status: "in_progress", updatedAt: new Date() },
    }),
  ]);

  return NextResponse.json(message, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id || (session.user as any).role !== "admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { id } = await params;
  const { status } = await req.json();

  const VALID = ["open", "in_progress", "closed"];
  if (!VALID.includes(status)) {
    return NextResponse.json({ error: "Status inválido." }, { status: 400 });
  }

  const ticket = await prisma.supportTicket.update({
    where: { id },
    data:  { status },
  });

  return NextResponse.json(ticket);
}
