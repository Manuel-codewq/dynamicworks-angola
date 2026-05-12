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

          // 10 tentativas por email por 15 minutos — protecção contra brute-force
          if (!await checkRateLimit("login", normalizedEmail, 10, 15 * 60_000)) {
            return null;
          }

          const user = await prisma.user.findUnique({
            where: { email: normalizedEmail },
          });

          if (!user) return null;
          if (user.status === "blocked") return null;
          if (user.emailVerified === false) return null;

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
        token.id   = user.id;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id          = token.id as string;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
});
