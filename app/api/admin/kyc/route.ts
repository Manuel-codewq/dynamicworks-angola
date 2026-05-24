import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if ((session?.user as unknown as { role: string })?.role !== "admin")
    return NextResponse.json({ error: "Proibido" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status"); // pending | approved | rejected | null (all)

  try {
    const [submissions, pendingCount, approvedCount, rejectedCount] = await Promise.all([
      prisma.kycSubmission.findMany({
        where: status ? { user: { kycStatus: status } } : undefined,
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          userId: true,
          faceFront: true,   // usado como avatar na tabela
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
      }),
      prisma.user.count({ where: { kycStatus: "pending" } }),
      prisma.user.count({ where: { kycStatus: "approved" } }),
      prisma.user.count({ where: { kycStatus: "rejected" } }),
    ]);

    const countMap = {
      pending:  pendingCount,
      approved: approvedCount,
      rejected: rejectedCount,
      all:      pendingCount + approvedCount + rejectedCount,
    };

    return NextResponse.json({ entries: submissions, counts: countMap });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    console.error("[admin/kyc GET]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
