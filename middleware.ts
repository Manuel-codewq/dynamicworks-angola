import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

export async function middleware(req: NextRequest) {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  // Falhar fechado: sem segredo não é possível verificar tokens — bloquear rotas protegidas
  if (!secret) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  const isSecure = req.nextUrl.protocol === "https:";
  const cookieName = isSecure ? "__Secure-authjs.session-token" : "authjs.session-token";

  const token = await getToken({ req, secret, cookieName });
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
