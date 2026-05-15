import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_ATTEMPTS = 4;
const BLOCK_MS = 30 * 60 * 1000; // 30 minutos

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { kycStatus: true, kycAttempts: true, kycBlockedUntil: true, kycSubmission: { select: { id: true } } },
    });

    return NextResponse.json({
      ...(user ?? { kycStatus: "none", kycAttempts: 0, kycBlockedUntil: null }),
      hasSubmission: !!(user?.kycSubmission),
    });
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

    // Limite de ~450KB por imagem (600 000 chars em base64 ≈ 450KB binário)
    const MAX_IMG = 600_000;
    const images: [string, string | undefined][] = [
      ["faceFront", faceFront], ["faceRight", faceRight], ["faceLeft", faceLeft],
      ["biFront", biFront],     ["biBack", biBack],
    ];
    for (const [field, value] of images) {
      if (value && value.length > MAX_IMG) {
        return NextResponse.json(
          { error: `Imagem ${field} demasiado grande. Máximo 450KB por imagem.` },
          { status: 413 }
        );
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { kycAttempts: true, kycBlockedUntil: true, kycStatus: true },
    });

    if (!user) return NextResponse.json({ error: "Utilizador não encontrado" }, { status: 404 });

    // Só bloqueia se já existe uma submissão real em análise
    if (user.kycStatus === "pending") {
      const existing = await prisma.kycSubmission.findUnique({ where: { userId }, select: { id: true } });
      if (existing) return NextResponse.json({ error: "pending" }, { status: 409 });
    }

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

    // Guardar documentos — tentativas só incrementam quando admin rejeita, não na submissão
    await prisma.kycSubmission.upsert({
      where: { userId },
      create: { userId, faceFront, faceRight: faceRight ?? "", faceLeft: faceLeft ?? "", biFront, biBack, livenessScore: livenessScore || 0 },
      update: { faceFront, faceRight: faceRight ?? "", faceLeft: faceLeft ?? "", biFront, biBack, livenessScore: livenessScore || 0, createdAt: new Date() },
    });

    await prisma.user.update({
      where: { id: userId },
      data: { kycStatus: "pending" },
    });

    return NextResponse.json({
      ok: true,
      attemptsUsed: user.kycAttempts,
      attemptsLeft: MAX_ATTEMPTS - user.kycAttempts,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    console.error("[kyc POST]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
