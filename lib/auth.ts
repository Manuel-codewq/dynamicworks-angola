import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";
import { checkRateLimit } from "./rateLimit";

// Hash placeholder usado para igualar o tempo de bcrypt.compare quando o utilizador
// não existe — evita enumeração de emails por timing. Gerado com bcrypt.hash("",12).
const DUMMY_HASH =
  "$2a$12$CwTycUXWue0Thq9StjUM0uJ8.GJ6JfQ6vBz0Y1pX9P5kQZ4Zk9w0a";

function extractIp(req: Request | undefined): string {
  if (!req) return "unknown";
  const h = req.headers;
  return (
    h.get("x-vercel-forwarded-for")?.split(",")[0].trim() ||
    h.get("cf-connecting-ip")?.trim() ||
    h.get("x-real-ip")?.trim() ||
    (() => {
      const fwd = h.get("x-forwarded-for");
      if (!fwd) return "";
      const ips = fwd.split(",").map(s => s.trim()).filter(Boolean);
      return ips[ips.length - 1] ?? "";
    })() ||
    "unknown"
  );
}

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
      async authorize(credentials, req) {
        try {
          if (!credentials?.email || !credentials?.password) return null;

          const normalizedEmail = (credentials.email as string).toLowerCase().trim();
          const ip = extractIp(req as unknown as Request);

          // Rate-limit por IP é a primeira linha de defesa contra brute-force
          // distribuído por contas. Limite generoso (30/15min) para não afectar
          // famílias atrás de NAT, mas suficiente para travar enumeração massiva.
          if (!await checkRateLimit("login_ip", ip, 30, 15 * 60_000)) {
            return null;
          }

          const user = await prisma.user.findUnique({
            where: { email: normalizedEmail },
          });

          // Rate-limit por email — limita brute-force focado num único alvo.
          // Aplicado APENAS quando a tentativa traz uma password (já passou no IP
          // rate-limit) para evitar account-lockout DoS trivial: o atacante
          // precisa de gastar tokens do IP-bucket dele para gastar tokens do
          // bucket do email da vítima.
          if (!await checkRateLimit("login_email", normalizedEmail, 10, 15 * 60_000)) {
            return null;
          }

          // bcrypt.compare contra hash dummy quando o utilizador não existe
          // para igualar o tempo de resposta e impedir enumeração de emails.
          const hashToCompare = user?.password ?? DUMMY_HASH;
          const valid = await bcrypt.compare(
            credentials.password as string,
            hashToCompare,
          );

          if (!user) return null;
          if (user.status === "blocked") return null;
          if (user.emailVerified === false) return null;
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

      // Refresh role + status from DB every 30s — janela curta para que bloqueios
      // e mudanças de role apliquem rapidamente (broker: prioridade > custo de query)
      const age = Date.now() - ((token.refreshedAt as number) ?? 0);
      if (age > 30_000) {
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
