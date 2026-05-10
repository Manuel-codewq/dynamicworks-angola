import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPasswordOtpEmail } from "@/lib/email";
import { randomInt } from "crypto";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    if (!checkRateLimit("pwd-otp", session.user.id, 3, 10 * 60_000)) {
      return NextResponse.json({ error: "Demasiados pedidos. Aguarde 10 minutos." }, { status: 429 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true, name: true },
    });
    if (!user) return NextResponse.json({ error: "Utilizador não encontrado" }, { status: 404 });

    const code    = String(randomInt(100000, 1000000));
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.user.update({
      where: { id: session.user.id },
      data:  { otpCode: code, otpExpires: expires },
    });

    await sendPasswordOtpEmail(user.email, user.name, code);

    return NextResponse.json({ sent: true });
  } catch (err) {
    console.error("[password-otp]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
