import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: { userId: string } }) {
  const session = await auth();
  if (session?.user?.role !== "admin") return NextResponse.json({ error: "Proibido" }, { status: 403 });

  const { userId } = params;

  const submission = await prisma.kycSubmission.findUnique({
    where: { userId },
  });

  if (!submission) return NextResponse.json({ error: "Submissão não encontrada" }, { status: 404 });

  return NextResponse.json(submission);
}
