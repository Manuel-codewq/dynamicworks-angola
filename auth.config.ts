import type { NextAuthConfig } from "next-auth";

// Configuração Edge-safe do NextAuth — sem Prisma, usada no middleware.
// O lib/auth.ts estende esta config com os providers e callbacks completos.
export const authConfig = {
  secret:    process.env.AUTH_SECRET,
  trustHost: true,
  session:   { strategy: "jwt" as const, maxAge: 7 * 24 * 3600 },
  pages:     { signIn: "/login" },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const role       = (auth?.user as any)?.role as string | undefined;

      // Proteger todo o painel admin ao nível do servidor
      if (nextUrl.pathname.startsWith("/ao/admin")) {
        if (!isLoggedIn) {
          return Response.redirect(new URL("/login", nextUrl));
        }
        if (role !== "admin") {
          return Response.redirect(new URL("/trade", nextUrl));
        }
        return true;
      }

      return true;
    },
  },
} satisfies NextAuthConfig;
