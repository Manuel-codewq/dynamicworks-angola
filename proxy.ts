import { NextRequest, NextResponse } from "next/server";
import { getToken } from "@auth/core/jwt";

const LOCALES  = ["pt", "en", "fr"] as const;
const DEFAULT  = "pt";
const COOKIE   = "dw_locale";

// Rotas que precisam de autenticação (sem prefixo de locale)
const PROTECTED = [
  "/trade", "/dashboard", "/wallet",
  "/profile", "/kyc", "/support", "/referral",
  "/security", "/history", "/tournaments", "/copy", "/ranking", "/achievements",
];

// Caminhos onde o locale routing não se aplica
const BYPASS_LOCALE = [
  /^\/_next\//,
  /^\/api\//,
  /^\/ao\//,
  /^\/sw\.js/,
  /^\/manifest\.json/,
  /^\/icon-/,
  /^\/og-image/,
  /^\/logo-icon/,
  /^\/favicon/,
  /^\/robots/,
];

function getLocaleFromCookie(req: NextRequest): string {
  const c = req.cookies.get(COOKIE)?.value;
  return LOCALES.includes(c as any) ? c! : DEFAULT;
}

async function getAuthToken(req: NextRequest) {
  return getToken({
    req,
    secret:       process.env.AUTH_SECRET!,
    secureCookie: process.env.NODE_ENV === "production",
  });
}

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Protecção de rotas admin (sem locale prefix) ──────────────────────────
  if (pathname.startsWith("/ao/admin")) {
    const token = await getAuthToken(req);
    if (!token) {
      const loc = getLocaleFromCookie(req);
      return NextResponse.redirect(new URL(`/${loc}/login`, req.url));
    }
    if ((token as any).role !== "admin") {
      const loc = getLocaleFromCookie(req);
      return NextResponse.redirect(new URL(`/${loc}/trade`, req.url));
    }
    return NextResponse.next();
  }

  // ── Ignorar rotas de sistema ───────────────────────────────────────────────
  if (BYPASS_LOCALE.some(r => r.test(pathname))) return NextResponse.next();

  // ── Extrair locale da URL ──────────────────────────────────────────────────
  const segments    = pathname.split("/");   // ["", "pt", "trade", ...]
  const maybeLocale = segments[1];
  const hasLocale   = LOCALES.includes(maybeLocale as any);

  if (hasLocale) {
    const locale        = maybeLocale as string;
    const effectivePath = "/" + segments.slice(2).join("/") || "/";

    // Verificar autenticação se rota é protegida
    const isProtected = PROTECTED.some(p => effectivePath.startsWith(p));
    if (isProtected) {
      const token = await getAuthToken(req);
      if (!token) {
        const loginUrl = new URL(`/${locale}/login`, req.url);
        // Só incluir callbackUrl se for caminho interno (sem protocolo/host)
        if (/^\/[^/\\]/.test(pathname) || pathname === "/") {
          loginUrl.searchParams.set("callbackUrl", pathname);
        }
        const res = NextResponse.redirect(loginUrl);
        res.cookies.set(COOKIE, locale, { path: "/", maxAge: 31_536_000, sameSite: "lax" });
        return res;
      }
    }

    // Rewrite: /en/trade → /trade (browser mantém /en/trade)
    const dest = new URL(effectivePath, req.url);
    dest.search = req.nextUrl.search;
    const res = NextResponse.rewrite(dest);
    res.cookies.set(COOKIE, locale, { path: "/", maxAge: 31_536_000, sameSite: "lax" });
    return res;
  }

  // ── Sem prefixo de locale → redirecionar para /{locale}{pathname} ─────────
  const locale = getLocaleFromCookie(req);
  const dest   = new URL(`/${locale}${pathname}`, req.url);
  dest.search  = req.nextUrl.search;
  return NextResponse.redirect(dest);
}

export const config = {
  matcher: [
    // Rotas com prefixo de locale
    "/(pt|en|fr)/:path*",
    // Rotas sem prefixo (para redirecionar com locale)
    "/",
    "/trade/:path*",
    "/dashboard/:path*",
    "/wallet/:path*",
    "/profile/:path*",
    "/kyc/:path*",
    "/support/:path*",
    "/referral/:path*",
    "/security/:path*",
    "/history/:path*",
    "/tournaments/:path*",
    "/copy/:path*",
    "/ranking/:path*",
    "/achievements/:path*",
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password/:path*",
    "/verify-email",
    "/terms",
    "/maintenance",
    // Admin (para verificação de auth)
    "/ao/admin/:path*",
  ],
};
