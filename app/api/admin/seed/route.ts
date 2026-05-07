import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Não disponível em produção" }, { status: 403 });
  }

  const email    = "seusburros91@gmail.com";
  const password = "Jedilson*2005";
  const hashed   = await bcrypt.hash(password, 12);

  // Demote any existing admins before creating the canonical one
  await prisma.user.updateMany({ where: { role: "admin" }, data: { role: "user" } });

  await prisma.user.upsert({
    where:  { email },
    update: { name: "Jedilson", password: hashed, role: "admin", status: "active" },
    create: {
      name:        "Jedilson",
      email,
      password:    hashed,
      role:        "admin",
      status:      "active",
      balance:     0,
      demoBalance: 0,
    },
  });

  return NextResponse.json({ ok: true, email, password });
}
