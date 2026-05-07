import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";

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

          const user = await prisma.user.findUnique({
            where: { email: normalizedEmail },
          });

          if (!user) return null;
          if (user.status === "blocked") return null;
          if (!user.emailVerified) return null;

          const valid = await bcrypt.compare(
            credentials.password as string,
            user.password
          );
          if (!valid) return null;

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            balance: user.balance,
            demoBalance: user.demoBalance,
            isDemo: user.isDemo,
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
        token.id = user.id;
        token.role = (user as any).role;
        token.balance = (user as any).balance;
        token.demoBalance = (user as any).demoBalance;
        token.isDemo = (user as any).isDemo;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        (session.user as any).role = token.role;
        (session.user as any).balance = token.balance;
        (session.user as any).demoBalance = token.demoBalance;
        (session.user as any).isDemo = token.isDemo;
      }
      return session;
    },
  },
});
