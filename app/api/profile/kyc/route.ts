import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_ATTEMPTS = 2;
const BLOCK_MS = 2 * 60 * 60 * 1000;

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { kycStatus: true, kycAttempts: true, kycBlockedUntil: true },
    });

    return NextResponse.json(user ?? { kycStatus: "pending", kycAttempts: 0, kycBlockedUntil: null });
  } catch (err) {
    console.error("[kyc GET]", err);
    return NextResponse.json({ kycStatus: "pending", kycAttempts: 0, kycBlockedUntil: null });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const userId = session.user.id;
    const body = await req.json();
    const { faceFront, faceRight, faceLeft, biFront, biBack, livenessScore } = body;

    if (!faceFront || !biFront || !biBack) {
      return NextResponse.json({ error: "Imagens incompletas. Faça o processo até ao fim." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { kycAttempts: true, kycBlockedUntil: true },
    });

    if (!user) return NextResponse.json({ error: "Utilizador não encontrado" }, { status: 404 });

    // Bloqueado?
    if (user.kycBlockedUntil && user.kycBlockedUntil > new Date()) {
      return NextResponse.json({ error: "blocked", blockedUntil: user.kycBlockedUntil.toISOString() }, { status: 429 });
    }

    // Esgotou tentativas?
    if (user.kycAttempts >= MAX_ATTEMPTS) {
      const blockedUntil = new Date(Date.now() + BLOCK_MS);
      await prisma.user.update({ where: { id: userId }, data: { kycBlockedUntil: blockedUntil } });
      return NextResponse.json({ error: "blocked", blockedUntil: blockedUntil.toISOString() }, { status: 429 });
    }

    const newAttempts = user.kycAttempts + 1;
    const blockedUntil = newAttempts >= MAX_ATTEMPTS ? new Date(Date.now() + BLOCK_MS) : null;

    await prisma.kycSubmission.upsert({
      where: { userId },
      create: { userId, faceFront, faceRight: faceRight ?? "", faceLeft: faceLeft ?? "", biFront, biBack, livenessScore: livenessScore || 0 },
      update: { faceFront, faceRight: faceRight ?? "", faceLeft: faceLeft ?? "", biFront, biBack, livenessScore: livenessScore || 0, createdAt: new Date() },
    });

    await prisma.user.update({
      where: { id: userId },
      data: {
        kycStatus: "pending",
        kycAttempts: newAttempts,
        ...(blockedUntil ? { kycBlockedUntil: blockedUntil } : {}),
      },
    });

    return NextResponse.json({
      ok: true,
      attemptsUsed: newAttempts,
      attemptsLeft: MAX_ATTEMPTS - newAttempts,
      ...(blockedUntil ? { blockedUntil: blockedUntil.toISOString() } : {}),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    console.error("[kyc POST]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
