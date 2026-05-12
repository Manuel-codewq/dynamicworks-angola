import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { image } = await req.json();
  if (!image || typeof image !== "string") {
    return NextResponse.json({ error: "Imagem em falta." }, { status: 400 });
  }
  // Accept base64 data URL or plain base64
  if (!image.startsWith("data:image/") && !image.match(/^[A-Za-z0-9+/=]+$/)) {
    return NextResponse.json({ error: "Formato de imagem inválido." }, { status: 400 });
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const preset    = process.env.CLOUDINARY_UPLOAD_PRESET ?? process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !preset) {
    return NextResponse.json({ error: "Cloudinary não configurado." }, { status: 500 });
  }

  // Upload to Cloudinary from the server — no NEXT_PUBLIC vars needed on client
  const fd = new FormData();
  fd.append("file",          image);
  fd.append("upload_preset", preset);

  const up = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: "POST", body: fd }
  );

  if (!up.ok) {
    const err = await up.text();
    console.error("[avatar upload] Cloudinary error:", err);
    return NextResponse.json({ error: "Falha no upload da imagem." }, { status: 502 });
  }

  const { secure_url } = await up.json();

  await prisma.user.update({
    where: { id: session.user.id },
    data:  { avatar: secure_url },
  });

  return NextResponse.json({ avatar: secure_url });
}
