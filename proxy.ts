import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const PROTECTED = [
  "/trade", "/dashboard", "/wallet", "/ao/admin",
  "/profile", "/kyc", "/support", "/referral", "/security", "/history",
];

export default async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.AUTH_SECRET });
  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED.some(r => pathname.startsWith(r));

  if (isProtected && !token) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  if (pathname.startsWith("/ao/admin") && (token as any)?.role !== "admin") {
    return NextResponse.redirect(new URL("/trade", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/trade/:path*",
    "/dashboard/:path*",
    "/wallet/:path*",
    "/ao/admin/:path*",
    "/profile/:path*",
    "/kyc/:path*",
    "/support/:path*",
    "/referral/:path*",
    "/security/:path*",
    "/history/:path*",
  ],
};
