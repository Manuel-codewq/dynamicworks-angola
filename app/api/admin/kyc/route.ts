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
    // Contar por estado em paralelo com a query principal
    const [submissions, counts] = await Promise.all([
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
      prisma.user.groupBy({
        by: ["kycStatus"],
        where: { kycStatus: { not: null } },
        _count: true,
      }),
    ]);

    const countMap: Record<string, number> = { pending: 0, approved: 0, rejected: 0 };
    for (const row of counts) {
      if (row.kycStatus) countMap[row.kycStatus] = (countMap[row.kycStatus] ?? 0) + row._count;
    }
    countMap.all = Object.values(countMap).reduce((a, b) => a + b, 0);

    return NextResponse.json({ entries: submissions, counts: countMap });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    console.error("[admin/kyc GET]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
