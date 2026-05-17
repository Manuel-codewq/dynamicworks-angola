import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateTotpSecret, getTotpUri } from "@/lib/totp";
import QRCode from "qrcode";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where:  { id: session.user.id },
    select: { email: true, twoFactorEnabled: true },
  });
  if (!user) return NextResponse.json({ error: "Utilizador não encontrado" }, { status: 404 });
  // Permite gerar novo secret mesmo com 2FA activo (reconfiguração)

  const secret = generateTotpSecret();
  const uri    = getTotpUri(user.email, secret);
  const qr     = await QRCode.toDataURL(uri);

  // Guarda o secret temporariamente (não activado ainda)
  await prisma.user.update({
    where: { id: session.user.id },
    data:  { twoFactorSecret: secret, twoFactorMethod: "totp" },
  });

  return NextResponse.json({ secret, qr });
}
