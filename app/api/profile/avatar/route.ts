import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Recebe apenas o URL já enviado ao Cloudinary pelo browser (igual ao KYC)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { avatarUrl } = await req.json();

  if (!avatarUrl || typeof avatarUrl !== "string" || !avatarUrl.startsWith("https://res.cloudinary.com/")) {
    return NextResponse.json({ error: "URL de avatar inválida." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data:  { avatar: avatarUrl },
  });

  return NextResponse.json({ avatar: avatarUrl });
}
