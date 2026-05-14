import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

type PhotoType = "face" | "bi_front" | "bi_back";

const PROMPTS: Record<PhotoType, string> = {
  face: `Analisa esta imagem e responde APENAS com JSON válido, sem texto antes ou depois.
Verifica se é uma selfie válida para verificação de identidade (KYC).
Critérios: rosto humano visível, iluminação suficiente para identificar a pessoa, imagem focada.
Aceita rostos parcialmente laterais, má qualidade moderada e iluminação imperfeita — sê permissivo.
Rejeita apenas: sem rosto visível, rosto completamente escuro/tapado, imagem completamente desfocada, imagem de outro ecrã.
Formato: {"valid": true/false, "reason": "mensagem curta em português para o utilizador"}`,

  bi_front: `Analisa esta imagem e responde APENAS com JSON válido, sem texto antes ou depois.
Verifica se é uma foto da FRENTE de um documento de identidade (BI angolano, passaporte ou outro documento oficial).
Aceita documentos ligeiramente inclinados ou com reflexo moderado.
Rejeita apenas: sem documento visível, foto de rosto em vez de documento, imagem completamente ilegível.
Formato: {"valid": true/false, "reason": "mensagem curta em português para o utilizador"}`,

  bi_back: `Analisa esta imagem e responde APENAS com JSON válido, sem texto antes ou depois.
Verifica se é uma foto do VERSO de um documento de identidade.
Aceita documentos ligeiramente inclinados, verso simples ou com pouca informação.
Rejeita apenas: sem documento visível, foto de rosto, imagem completamente preta/branca.
Formato: {"valid": true/false, "reason": "mensagem curta em português para o utilizador"}`,
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { image, type } = await req.json() as { image: string; type: PhotoType };

  if (!image || !PROMPTS[type]) {
    return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  }

  // Extrai base64 puro (remove prefixo data:image/...;base64,)
  const base64Match = image.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!base64Match) {
    return NextResponse.json({ error: "Formato de imagem inválido" }, { status: 400 });
  }

  const mediaType = base64Match[1] as "image/jpeg" | "image/png" | "image/webp";
  const base64Data = base64Match[2];

  // Verifica tamanho — Claude aceita até ~5MB em base64
  if (base64Data.length > 6_000_000) {
    return NextResponse.json({ error: "Imagem demasiado grande. Máximo 4MB." }, { status: 413 });
  }

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 120,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: base64Data },
          },
          { type: "text", text: PROMPTS[type] },
        ],
      }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text.trim() : "";

    // Extrai JSON da resposta
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // Se Claude não retornou JSON válido, aceita a imagem (fallback permissivo)
      console.warn("[kyc/validate] Claude não retornou JSON:", text);
      return NextResponse.json({ valid: true, reason: "" });
    }

    const result = JSON.parse(jsonMatch[0]) as { valid: boolean; reason: string };
    return NextResponse.json(result);
  } catch (err) {
    console.error("[kyc/validate] Claude error:", err);
    // Em caso de erro da API, aceita a imagem — não bloqueia o utilizador
    return NextResponse.json({ valid: true, reason: "" });
  }
}
