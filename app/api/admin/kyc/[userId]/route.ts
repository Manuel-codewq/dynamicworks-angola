import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const session = await auth();
  if ((session?.user as any)?.role !== "admin") return NextResponse.json({ error: "Proibido" }, { status: 403 });

  const { userId } = await params;

  const submission = await prisma.kycSubmission.findUnique({
    where: { userId },
  });

  if (!submission) return NextResponse.json({ error: "Submissão não encontrada" }, { status: 404 });

  return NextResponse.json(submission);
}

// Reset de tentativas KYC — admin pode desbloquear utilizador manualmente
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const session = await auth();
  if ((session?.user as any)?.role !== "admin") return NextResponse.json({ error: "Proibido" }, { status: 403 });

  const { userId } = await params;

  await prisma.user.update({
    where: { id: userId },
    data: { kycAttempts: 0, kycBlockedUntil: null },
  });

  return NextResponse.json({ ok: true });
}
