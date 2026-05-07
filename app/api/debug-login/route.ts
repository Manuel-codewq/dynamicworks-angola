import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    const checks: Record<string, any> = {
      DATABASE_URL: !!process.env.DATABASE_URL,
      AUTH_SECRET: !!process.env.AUTH_SECRET,
      NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
    };

    let user: any = null;
    try {
      user = await prisma.user.findUnique({
        where: { email: email?.toLowerCase().trim() },
        select: { id: true, email: true, role: true, status: true, emailVerified: true, password: true },
      });
      checks.dbConnected = true;
      checks.userFound = !!user;
    } catch (err: any) {
      checks.dbConnected = false;
      checks.dbError = err?.message;
      return NextResponse.json(checks);
    }

    if (!user) return NextResponse.json({ ...checks, reason: "user_not_found" });
    if (user.status === "blocked") return NextResponse.json({ ...checks, reason: "blocked" });
    if (!user.emailVerified) return NextResponse.json({ ...checks, reason: "not_verified", emailVerified: user.emailVerified });

    const validPassword = await bcrypt.compare(password, user.password);
    checks.passwordMatch = validPassword;
    checks.role = user.role;
    checks.emailVerified = user.emailVerified;
    checks.reason = validPassword ? "should_login_ok" : "wrong_password";

    return NextResponse.json(checks);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
