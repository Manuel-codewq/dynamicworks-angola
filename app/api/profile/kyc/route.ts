import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { v2 as cloudinary } from "cloudinary";

// Configure Cloudinary
// Ensure these are added to .env.local
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function uploadToCloudinary(base64Image: string, folder: string): Promise<string> {
  if (!base64Image) return "";
  try {
    const result = await cloudinary.uploader.upload(base64Image, { folder });
    return result.secure_url;
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw new Error("Falha ao enviar imagem para a nuvem");
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    const data = await req.json();
    const { faceFront, faceRight, faceLeft, biFront, biBack } = data;

    if (!faceFront || !biFront || !biBack) {
      return NextResponse.json({ error: "Imagens incompletas. Faça o processo até ao fim." }, { status: 400 });
    }

    const userId = session.user.id;

    // Upload to Cloudinary concurrently to save time
    const [face1, face2, face3, bi1, bi2] = await Promise.all([
      uploadToCloudinary(faceFront, `kyc/${userId}/face`),
      uploadToCloudinary(faceRight, `kyc/${userId}/face`),
      uploadToCloudinary(faceLeft, `kyc/${userId}/face`),
      uploadToCloudinary(biFront, `kyc/${userId}/bi`),
      uploadToCloudinary(biBack, `kyc/${userId}/bi`),
    ]);

    // Upsert KycSubmission (create if not exists, update if exists)
    await prisma.kycSubmission.upsert({
      where: { userId },
      create: {
        userId,
        faceFront: face1,
        faceRight: face2,
        faceLeft: face3,
        biFront: bi1,
        biBack: bi2,
      },
      update: {
        faceFront: face1,
        faceRight: face2,
        faceLeft: face3,
        biFront: bi1,
        biBack: bi2,
        createdAt: new Date(),
      },
    });

    // Update user status
    await prisma.user.update({
      where: { id: userId },
      data: { kycStatus: "pending" },
    });

    return NextResponse.json({ ok: true, message: "KYC Submetido com sucesso" });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message || "Erro interno ao processar KYC" }, { status: 500 });
  }
}

