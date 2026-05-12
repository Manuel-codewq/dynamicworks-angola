import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { updateSettings } from "@/lib/settings";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id || (session.user as any).role !== "admin")
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  const resetAt = new Date();
  await updateSettings({ rankingResetAt: resetAt });

  await prisma.auditLog.create({
    data: {
      adminId:   session.user.id,
      adminName: session.user.name ?? "Admin",
      action:    "RESET_RANKING",
      target:    "ranking",
      detail:    `Ranking zerado em ${resetAt.toISOString()}`,
    },
  });

  return NextResponse.json({ ok: true, resetAt });
}
