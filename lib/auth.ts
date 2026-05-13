import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";
import { checkRateLimit } from "./rateLimit";

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) return null;

          const normalizedEmail = (credentials.email as string).toLowerCase().trim();

          // Verificar existência e estado do utilizador ANTES do rate limit
          // para que tentativas bloqueadas (email não verificado, conta bloqueada)
          // não consumam tokens — evita lockout acidental após verificação de email
          const user = await prisma.user.findUnique({
            where: { email: normalizedEmail },
          });

          if (!user) return null;
          if (user.status === "blocked") return null;
          if (user.emailVerified === false) return null;

          // Só aplica rate limit a utilizadores válidos com email verificado
          if (!await checkRateLimit("login", normalizedEmail, 10, 15 * 60_000)) {
            return null;
          }

          const valid = await bcrypt.compare(
            credentials.password as string,
            user.password
          );
          if (!valid) return null;

          // Apenas dados imutáveis ou de longa vida no JWT
          // balance/demoBalance/isDemo são lidos em tempo real via /api/balance
          return {
            id:    user.id,
            name:  user.name,
            email: user.email,
            role:  user.role,
          };
        } catch (err) {
          console.error("[auth] authorize error:", err);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id          = user.id;
        token.role        = (user as any).role;
        token.refreshedAt = Date.now();
      }

      // Refresh role + status from DB every 5 minutes
      const age = Date.now() - ((token.refreshedAt as number) ?? 0);
      if (age > 5 * 60_000) {
        try {
          const dbUser = await prisma.user.findUnique({
            where:  { id: token.id as string },
            select: { role: true, status: true },
          });
          // Blocked or deleted user → invalidate JWT immediately
          if (!dbUser || dbUser.status === "blocked") return null as any;
          token.role        = dbUser.role;
          token.refreshedAt = Date.now();
        } catch { /* DB unavailable — keep existing token */ }
      }

      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id            = token.id as string;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
});
