import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createHash } from "crypto";

const ALLOWED_FOLDERS = ["avatars", "kyc"] as const;
type UploadFolder = typeof ALLOWED_FOLDERS[number];

function buildSignature(params: Record<string, string>, apiSecret: string): string {
  const sorted = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join("&");
  return createHash("sha256").update(sorted + apiSecret).digest("hex");
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey    = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return NextResponse.json({ error: "Cloudinary não configurado" }, { status: 500 });
  }

  let body: { file?: string; folder?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  }

  const { file, folder } = body;

  if (!file || typeof file !== "string") {
    return NextResponse.json({ error: "Ficheiro em falta" }, { status: 400 });
  }
  if (!ALLOWED_FOLDERS.includes(folder as UploadFolder)) {
    return NextResponse.json({ error: "Pasta inválida" }, { status: 400 });
  }

  // Limite de ~2MB em base64
  if (file.length > 2_800_000) {
    return NextResponse.json({ error: "Ficheiro demasiado grande (máx 2MB)" }, { status: 413 });
  }

  const timestamp = String(Math.floor(Date.now() / 1000));
  const publicId  = `${folder}/${session.user.id}_${timestamp}`;

  const params: Record<string, string> = {
    folder: folder as string,
    public_id: publicId,
    timestamp,
  };
  const signature = buildSignature(params, apiSecret);

  const fd = new FormData();
  fd.append("file",      file);
  fd.append("api_key",   apiKey);
  fd.append("timestamp", timestamp);
  fd.append("folder",    folder as string);
  fd.append("public_id", publicId);
  fd.append("signature", signature);

  const up = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: "POST", body: fd },
  );

  if (!up.ok) {
    const err = await up.text().catch(() => "");
    console.error("[upload] Cloudinary error:", err);
    return NextResponse.json({ error: "Falha no upload" }, { status: 502 });
  }

  const { secure_url } = await up.json();
  return NextResponse.json({ url: secure_url });
}
