import { NextRequest, NextResponse } from "next/server";
import { getToken } from "@auth/core/jwt";

const PROTECTED_ROUTES = [
  "/trade", "/dashboard", "/wallet", "/ao/admin",
  "/profile", "/kyc", "/support", "/referral", "/security", "/history",
];

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED_ROUTES.some(r => pathname.startsWith(r));
  if (!isProtected) return NextResponse.next();

  const token = await getToken({
    req,
    secret:       process.env.AUTH_SECRET!,
    secureCookie: process.env.NODE_ENV === "production",
  });

  if (!token) {
    const loginUrl = new URL("/login", req.nextUrl);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/ao/admin") && (token as any).role !== "admin") {
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
