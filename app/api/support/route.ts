import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rateLimit";

const CATEGORIES = ["deposito", "levantamento", "kyc", "conta", "tecnico", "outro"] as const;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const tickets = await prisma.supportTicket.findMany({
    where:   { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    include: {
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
      _count:   { select: { messages: true } },
    },
  });

  return NextResponse.json(tickets);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  if (!await checkRateLimit("support-create", session.user.id, 5, 60 * 60_000)) {
    return NextResponse.json({ error: "Demasiados tickets. Tente mais tarde." }, { status: 429 });
  }

  const { subject, category, body } = await req.json();

  if (!subject || String(subject).trim().length < 5) {
    return NextResponse.json({ error: "Assunto deve ter pelo menos 5 caracteres." }, { status: 400 });
  }
  if (!body || String(body).trim().length < 10) {
    return NextResponse.json({ error: "Mensagem deve ter pelo menos 10 caracteres." }, { status: 400 });
  }
  if (category && !CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "Categoria inválida." }, { status: 400 });
  }

  const ticket = await prisma.supportTicket.create({
    data: {
      userId:   session.user.id,
      subject:  String(subject).slice(0, 120).trim(),
      category: category ?? "outro",
      status:   "open",
      messages: {
        create: { body: String(body).slice(0, 2000).trim(), isAdmin: false },
      },
    },
    include: { messages: true },
  });

  return NextResponse.json(ticket, { status: 201 });
}
