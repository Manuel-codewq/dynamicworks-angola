import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import { checkRateLimit, resetFailCount, incrementFailCount } from "./rateLimit";
import { parseDevice } from "./parseDevice";
import { sendNewLoginEmail } from "./email";
import { checkIpCollision } from "./fraudDetection";

const DUMMY_HASH =
  "$2a$12$CwTycUXWue0Thq9StjUM0uJ8.GJ6JfQ6vBz0Y1pX9P5kQZ4Zk9w0a";

function extractIp(req: Request | undefined): string {
  if (!req) return "unknown";
  const h = req.headers;
  // Cloudflare injeta cf-connecting-ip com o IP real do cliente — tem prioridade máxima
  const cfIp = h.get("cf-connecting-ip")?.trim();
  if (cfIp) return cfIp;
  // Vercel edge injeta x-vercel-forwarded-for
  const vercelIp = h.get("x-vercel-forwarded-for")?.split(",")[0].trim();
  if (vercelIp) return vercelIp;
  // Proxy de confiança (nginx/traefik)
  const realIp = h.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  // Fallback: PRIMEIRO IP do x-forwarded-for (cliente original)
  // Nota: o último IP é adicionado pelo proxy mais próximo e pode ser falsificado
  // se o cliente aceder directamente ao servidor sem proxy
  const fwd = h.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0].trim();
    if (first) return first;
  }
  return "unknown";
}

async function logAccess(
  action: string,
  opts: { userId?: string; email?: string; ip?: string; userAgent?: string },
) {
  try {
    await prisma.accessLog.create({
      data: {
        action,
        userId:    opts.userId,
        email:     opts.email,
        ip:        opts.ip,
        userAgent: opts.userAgent,
      },
    });
  } catch { /* non-critical */ }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt", maxAge: 7 * 24 * 3600 },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email:    { label: "Email",    type: "email" },
        password: { label: "Password", type: "password" },
        otp:      { label: "OTP",      type: "text" },
      },
      async authorize(credentials, req) {
        try {
          if (!credentials?.email || !credentials?.password) return null;

          const email     = (credentials.email as string).toLowerCase().trim();
          const ip        = extractIp(req as unknown as Request);
          const userAgent = (req as any)?.headers?.get?.("user-agent") ?? "";
          const otp       = (credentials.otp as string | undefined)?.trim();

          if (!await checkRateLimit("login_ip", ip, 30, 15 * 60_000)) {
            await logAccess("login_fail_ratelimit", { email, ip, userAgent });
            return null;
          }

          const user = await prisma.user.findUnique({ where: { email } });

          if (!await checkRateLimit("login_email", email, 10, 15 * 60_000)) {
            await logAccess("login_fail_ratelimit", { email, ip, userAgent });
            return null;
          }

          const { default: bcrypt } = await import("bcryptjs");
          const hashToCompare = user?.password ?? DUMMY_HASH;
          const valid = await bcrypt.compare(credentials.password as string, hashToCompare);

          if (!user || !valid || user.status === "blocked" || user.emailVerified === false) {
            await logAccess("login_fail", { email, ip, userAgent });
            return null;
          }

          // ── 2FA — verificação do OTP (passo 2, após /api/auth/2fa/initiate) ──
          if (user.twoFactorEnabled) {
            if (!otp) {
              // Sem OTP e 2FA activo — bloquear (o fluxo correcto usa /api/auth/2fa/initiate)
              await logAccess("login_fail", { email, ip, userAgent });
              return null;
            }

            let otpValid = false;
            if (user.twoFactorMethod === "email") {
              // timingSafeEqual previne ataques de timing na comparação do OTP
              const { timingSafeEqual } = await import("crypto");
              const stored  = user.twoFaCode ?? "";
              const maxLen  = Math.max(otp.length, stored.length, 1);
              const codeMatch =
                stored.length === otp.length &&
                timingSafeEqual(
                  Buffer.from(otp.padEnd(maxLen, "\0")),
                  Buffer.from(stored.padEnd(maxLen, "\0")),
                );
              otpValid =
                codeMatch &&
                !!user.twoFaExpires &&
                user.twoFaExpires > new Date();
              if (otpValid) {
                await prisma.user.update({
                  where: { id: user.id },
                  data:  { twoFaCode: null, twoFaExpires: null },
                });
              }
            } else if (user.twoFactorMethod === "totp" && user.twoFactorSecret) {
              const { verifyTotpToken } = await import("./totp");
              otpValid = await verifyTotpToken(otp, user.twoFactorSecret);
            }

            if (!otpValid) {
              await logAccess("2fa_fail", { userId: user.id, email, ip, userAgent });
              // Após 5 falhas de OTP, invalidar o código — força o utilizador a pedir um novo
              const otpFails = await incrementFailCount(`2fa_otp:${user.id}`, 10 * 60_000);
              if (otpFails >= 5 && user.twoFactorMethod === "email") {
                await prisma.user.update({
                  where: { id: user.id },
                  data:  { twoFaCode: null, twoFaExpires: null },
                });
              }
              throw new Error("2FA_INVALID");
            }
            await logAccess("2fa_ok", { userId: user.id, email, ip, userAgent });
          }

          // ── Criar sessão ─────────────────────────────────────────────────────
          const device = parseDevice(userAgent);
          const session = await prisma.userSession.create({
            data: { userId: user.id, ip, userAgent, device, isActive: true },
          });

          await logAccess("login_ok", { userId: user.id, email, ip, userAgent });

          // Limpar contador de falhas após login bem-sucedido
          resetFailCount(`login:${email}`).catch(() => {});

          // Detecção de fraude — IP partilhado (assíncrono, não bloqueia login)
          checkIpCollision(ip, user.id).catch(() => {});

          // Notificação de novo IP/dispositivo (assíncrono, não bloqueia login)
          prisma.userSession.findFirst({
            where: {
              userId:    user.id,
              ip,
              id:        { not: session.id },
              createdAt: { gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) },
            },
            select: { id: true },
          }).then(existingIp => {
            if (!existingIp) {
              const dateStr = new Date().toLocaleString("pt-PT", { timeZone: "Africa/Luanda" });
              sendNewLoginEmail(user.email, user.name ?? "Trader", ip, device, dateStr).catch(() => {});
            }
          }).catch(() => {});

          return {
            id:        user.id,
            name:      user.name,
            email:     user.email,
            role:      user.role,
            sessionId: session.id,
          };
        } catch (err: any) {
          // Re-throw 2FA_INVALID para o cliente mostrar mensagem correcta
          if (err.message === "2FA_INVALID") throw err;
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
        token.sessionId   = (user as any).sessionId;
        token.refreshedAt = Date.now();
      }

      const age = Date.now() - ((token.refreshedAt as number) ?? 0);
      if (age > 30_000) {
        try {
          const [dbUser, dbSession] = await Promise.all([
            prisma.user.findUnique({
              where:  { id: token.id as string },
              select: { role: true, status: true },
            }),
            token.sessionId
              ? prisma.userSession.findUnique({
                  where:  { id: token.sessionId as string },
                  select: { isActive: true },
                })
              : null,
          ]);

          if (!dbUser || dbUser.status === "blocked") return null as any;
          if (dbSession && !dbSession.isActive) return null as any;

          // Actualiza lastActiveAt da sessão
          if (token.sessionId) {
            await prisma.userSession.update({
              where: { id: token.sessionId as string },
              data:  { lastActiveAt: new Date() },
            }).catch(() => {});
          }

          token.role        = dbUser.role;
          token.refreshedAt = Date.now();
        } catch { /* DB unavailable */ }
      }

      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id            = token.id as string;
        (session.user as any).role = token.role;
        (session.user as any).sessionId = token.sessionId;
      }
      return session;
    },
  },
});
