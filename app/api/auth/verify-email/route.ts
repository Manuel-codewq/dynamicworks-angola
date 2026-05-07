import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { email, code } = await req.json();
    if (!email || !code) {
      return NextResponse.json({ error: "Dados em falta" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user) {
      return NextResponse.json({ error: "Utilizador não encontrado" }, { status: 404 });
    }
    if (user.emailVerified) {
      return NextResponse.json({ success: true, alreadyVerified: true });
    }
    if (!user.verifyCode || !user.verifyExpires) {
      return NextResponse.json({ error: "Código inválido" }, { status: 400 });
    }
    if (new Date() > user.verifyExpires) {
      return NextResponse.json({ error: "Código expirado. Solicita um novo código." }, { status: 400 });
    }
    if (user.verifyCode !== code.trim()) {
      return NextResponse.json({ error: "Código incorrecto" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, verifyCode: null, verifyExpires: null },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
