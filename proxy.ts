import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const session = req.auth;
  const { pathname } = req.nextUrl;

  const protectedRoutes = ["/trade", "/dashboard", "/wallet", "/ao/admin", "/profile", "/kyc", "/support", "/referral", "/security", "/history"];
  const isProtected = protectedRoutes.some(r => pathname.startsWith(r));

  if (isProtected && !session) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  if (pathname.startsWith("/ao/admin")) {
    if ((session?.user as any)?.role !== "admin") {
      return NextResponse.redirect(new URL("/trade", req.nextUrl));
    }
  }

  return NextResponse.next();
});

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
