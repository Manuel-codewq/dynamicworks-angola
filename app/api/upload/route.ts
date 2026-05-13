import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createHash } from "crypto";

const ALLOWED_FOLDERS = ["avatars", "kyc"] as const;
type UploadFolder = typeof ALLOWED_FOLDERS[number];

const ALLOWED_MIME_PREFIXES = [
  "data:image/jpeg;base64,",
  "data:image/png;base64,",
  "data:image/webp;base64,",
  "data:image/gif;base64,",
];

// Magic numbers (primeiros bytes) — validam o conteúdo real, não confiando
// apenas no prefixo MIME que o cliente escolheu colocar.
function detectImageMime(buf: Buffer): "jpeg" | "png" | "webp" | "gif" | null {
  if (buf.length < 12) return null;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) return "png";
  // GIF: "GIF87a" ou "GIF89a"
  if (
    buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38 &&
    (buf[4] === 0x37 || buf[4] === 0x39) && buf[5] === 0x61
  ) return "gif";
  // WebP: "RIFF" .... "WEBP"
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return "webp";
  return null;
}

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

  // Apenas imagens JPEG, PNG, WebP ou GIF (cheque do prefixo declarado)
  const declaredPrefix = ALLOWED_MIME_PREFIXES.find(prefix => file.startsWith(prefix));
  if (!declaredPrefix) {
    return NextResponse.json({ error: "Tipo de ficheiro não permitido. Use JPEG, PNG, WebP ou GIF." }, { status: 415 });
  }

  // Limite de ~2MB em base64 (~2.1MB reais)
  if (file.length > 2_800_000) {
    return NextResponse.json({ error: "Ficheiro demasiado grande (máx 2MB)" }, { status: 413 });
  }

  // Valida o conteúdo real pelos magic numbers — não basta confiar no prefixo
  // que o cliente colocou. Decodifica apenas os primeiros 16 bytes para isso.
  const base64 = file.slice(declaredPrefix.length);
  let header: Buffer;
  try {
    header = Buffer.from(base64.slice(0, 32), "base64");
  } catch {
    return NextResponse.json({ error: "Conteúdo inválido" }, { status: 400 });
  }
  const detected = detectImageMime(header);
  if (!detected) {
    return NextResponse.json({ error: "Conteúdo não corresponde a uma imagem válida" }, { status: 415 });
  }
  // O prefixo declarado tem de bater com o conteúdo real
  if (!declaredPrefix.includes(`/${detected};`)) {
    return NextResponse.json({ error: "Tipo declarado não corresponde ao conteúdo" }, { status: 415 });
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
