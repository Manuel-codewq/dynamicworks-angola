import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rateLimit";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;

  const ticket = await prisma.supportTicket.findUnique({
    where:   { id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  if (!ticket || ticket.userId !== session.user.id) {
    return NextResponse.json({ error: "Ticket não encontrado." }, { status: 404 });
  }

  return NextResponse.json(ticket);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  if (!await checkRateLimit("support-msg", session.user.id, 20, 60 * 60_000)) {
    return NextResponse.json({ error: "Demasiadas mensagens. Tente mais tarde." }, { status: 429 });
  }

  const { id } = await params;
  const { body } = await req.json();

  if (!body || String(body).trim().length < 2) {
    return NextResponse.json({ error: "Mensagem demasiado curta." }, { status: 400 });
  }

  const ticket = await prisma.supportTicket.findUnique({ where: { id } });
  if (!ticket || ticket.userId !== session.user.id) {
    return NextResponse.json({ error: "Ticket não encontrado." }, { status: 404 });
  }
  if (ticket.status === "closed") {
    return NextResponse.json({ error: "Este ticket está fechado." }, { status: 400 });
  }

  const [message] = await prisma.$transaction([
    prisma.supportMessage.create({
      data: { ticketId: id, body: String(body).slice(0, 2000).trim(), isAdmin: false },
    }),
    prisma.supportTicket.update({
      where: { id },
      data:  { status: "open", updatedAt: new Date() },
    }),
  ]);

  return NextResponse.json(message, { status: 201 });
}
