import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/webPush";

export async function GET() {
  const tournaments = await prisma.tournament.findMany({
    orderBy: { startDate: "asc" },
    include: { _count: { select: { participants: true } } },
  });
  return NextResponse.json(tournaments);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if ((session.user as any).role !== "admin") return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const { name, description, rules, startDate, endDate, prizePool, prizes, isFree, isDemo, entryFee, maxParticipants, bannerColor } = await req.json();

  if (!name || !startDate || !endDate) {
    return NextResponse.json({ error: "Nome, data de início e data de fim são obrigatórios" }, { status: 400 });
  }
  if (new Date(startDate) >= new Date(endDate)) {
    return NextResponse.json({ error: "Data de início deve ser anterior à data de fim" }, { status: 400 });
  }

  const now = new Date();
  const status = new Date(startDate) > now ? "upcoming" : new Date(endDate) < now ? "finished" : "active";

  let tournament: any;
  try {
    tournament = await prisma.tournament.create({
      data: {
        name: String(name).slice(0, 100),
        description: description ? String(description).slice(0, 1000) : null,
        rules: rules ? String(rules).slice(0, 2000) : null,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        prizePool: Number(prizePool) || 0,
        prizes: prizes ?? [],
        status,
        isFree: isFree !== false,
        isDemo: isDemo === true,
        entryFee: isFree !== false ? 0 : Number(entryFee) || 0,
        maxParticipants: maxParticipants ? Number(maxParticipants) : null,
        bannerColor: bannerColor ?? "#f5a623",
      },
    });
  } catch (err) {
    console.error("[tournaments/create]", err);
    return NextResponse.json({ error: "Erro ao criar torneio. Tenta novamente." }, { status: 500 });
  }

  // Notificar todos os utilizadores activos sobre o novo torneio
  try {
    const users = await prisma.user.findMany({ where: { status: "active" }, select: { id: true } });
    const typeLabel  = tournament.isDemo ? "Demo" : "Real";
    const entryLabel = tournament.isFree ? "Entrada gratuita" : `Entrada: ${Number(entryFee).toLocaleString("pt-PT")} Kz`;
    const prizeLabel = Number(prizePool) > 0 ? ` · Prémio: ${Number(prizePool).toLocaleString("pt-PT")} Kz` : "";
    const notifTitle = `Novo Torneio ${typeLabel} — ${tournament.name}`;
    const notifBody  = `${entryLabel}${prizeLabel}. Inscreve-te agora e compete pelo topo!`;

    if (users.length > 0) {
      await prisma.notification.createMany({
        data: users.map(u => ({
          userId:  u.id,
          type:    "broadcast",
          title:   notifTitle,
          message: notifBody,
        })),
      });
      Promise.allSettled(
        users.map(u => sendPushToUser(u.id, {
          title: notifTitle,
          body:  notifBody,
          url:   `/tournaments/${tournament.id}`,
          tag:   "tournament-launch",
        }))
      ).catch(() => {});
    }
  } catch (err) {
    console.error("[tournaments/notify]", err);
  }

  return NextResponse.json(tournament, { status: 201 });
}
