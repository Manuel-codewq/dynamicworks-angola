import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth(async (req) => {
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

  // Maintenance check for non-admin protected routes
  if (isProtected && !pathname.startsWith("/ao/admin")) {
    const role = session?.user ? (session.user as any).role : null;
    if (role !== "admin") {
      try {
        const res = await fetch(new URL("/api/maintenance-check", nextUrl), {
          signal: AbortSignal.timeout(2000),
        });
        if (res.ok) {
          const { maintenance } = await res.json();
          if (maintenance) {
            return NextResponse.redirect(new URL("/maintenance", nextUrl));
          }
        }
      } catch {
        // If maintenance check fails, allow through to avoid blocking users
      }
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/trade/:path*", "/dashboard/:path*", "/wallet/:path*", "/ao/admin/:path*", "/profile/:path*"],
};
