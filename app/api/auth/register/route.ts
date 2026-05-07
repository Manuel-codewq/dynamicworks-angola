import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { sendVerificationEmail } from "@/lib/email";

const PROVINCES = [
  "Bengo","Benguela","Bié","Cabinda","Cuando Cubango","Cuanza Norte",
  "Cuanza Sul","Cunene","Huambo","Huíla","Luanda","Lunda Norte",
  "Lunda Sul","Malanje","Moxico","Namibe","Uíge","Zaire",
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, password, phone, province } = body;

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Campos obrigatórios em falta" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "A senha deve ter pelo menos 6 caracteres" }, { status: 400 });
    }
    if (province && !PROVINCES.includes(province)) {
      return NextResponse.json({ error: "Província inválida" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email já registado" }, { status: 409 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const hashed = await bcrypt.hash(password, 12);
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const verifyExpires = new Date(Date.now() + 15 * 60 * 1000);

    const user = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        password: hashed,
        phone,
        province,
        verifyCode: code,
        verifyExpires,
        emailVerified: false,
      },
    });

    try {
      await sendVerificationEmail(user.email, user.name, code);
    } catch (err) {
      console.error("[email] Falha ao enviar email de verificação:", err);
    }

    return NextResponse.json(
      { success: true, userId: user.id, redirect: `/verify-email?email=${encodeURIComponent(normalizedEmail)}` },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
