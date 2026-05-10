import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if ((session?.user as unknown as { role: string })?.role !== "admin")
    return NextResponse.json({ error: "Proibido" }, { status: 403 });

  try {
    const submissions = await prisma.kycSubmission.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        userId: true,
        faceFront: true,
        faceRight: true,
        faceLeft: true,
        biFront: true,
        biBack: true,
        livenessScore: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            province: true,
            kycStatus: true,
            kycAttempts: true,
            kycBlockedUntil: true,
            createdAt: true,
          },
        },
      },
    });

    return NextResponse.json(submissions);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    console.error("[admin/kyc GET]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
