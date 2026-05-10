import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { otpCode, newPassword } = await req.json();

    if (!otpCode || !newPassword) {
      return NextResponse.json({ error: "Preencha todos os campos" }, { status: 400 });
    }
    if (String(newPassword).length < 8) {
      return NextResponse.json({ error: "A nova senha deve ter pelo menos 8 caracteres" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, otpCode: true, otpExpires: true },
    });
    if (!user) return NextResponse.json({ error: "Utilizador não encontrado" }, { status: 404 });

    if (!user.otpCode || !user.otpExpires) {
      return NextResponse.json({ error: "Nenhum código enviado. Solicite um novo código." }, { status: 400 });
    }
    if (new Date() > user.otpExpires) {
      return NextResponse.json({ error: "Código expirado. Solicite um novo." }, { status: 400 });
    }
    if (String(otpCode).trim() !== user.otpCode) {
      return NextResponse.json({ error: "Código incorreto." }, { status: 400 });
    }

    const hashed = await bcrypt.hash(String(newPassword), 12);
    await prisma.user.update({
      where: { id: user.id },
      data:  { password: hashed, otpCode: null, otpExpires: null },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[password PATCH]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
