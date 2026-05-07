import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET });
  const { pathname } = req.nextUrl;

  const protectedRoutes = ["/trade", "/dashboard", "/wallet", "/ao/admin", "/profile"];
  const isProtected = protectedRoutes.some(r => pathname.startsWith(r));

  if (isProtected && !token) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  if (pathname.startsWith("/ao/admin")) {
    if ((token as any)?.role !== "admin") {
      return NextResponse.redirect(new URL("/trade", req.nextUrl));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/trade/:path*", "/dashboard/:path*", "/wallet/:path*", "/ao/admin/:path*", "/profile/:path*"],
};
