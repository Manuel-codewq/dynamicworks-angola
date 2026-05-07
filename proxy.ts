import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { nextUrl, auth: session } = req as any;
  const pathname = nextUrl.pathname;

  const protectedRoutes = ["/trade", "/dashboard", "/wallet", "/ao/admin", "/profile"];
  const isProtected = protectedRoutes.some(r => pathname.startsWith(r));

  if (isProtected && !session) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  if (pathname.startsWith("/ao/admin")) {
    const role = session?.user ? (session.user as any).role : null;
    if (role !== "admin") {
      return NextResponse.redirect(new URL("/trade", nextUrl));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/trade/:path*", "/dashboard/:path*", "/wallet/:path*", "/ao/admin/:path*", "/profile/:path*"],
};
