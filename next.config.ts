import type { NextConfig } from "next";

// Fontes externas legítimas usadas pela aplicação
const ALLOWED_IMG_SRCS = [
  "blob:",
  "data:",
  "https://res.cloudinary.com",   // avatares e documentos KYC
].join(" ");

const ALLOWED_CONNECT_SRCS = [
  "'self'",
  "https://api.anthropic.com",
  "wss://ws.derivws.com",
  "wss://ws.binaryws.com",
  "wss://frontend.binaryws.com",
  "https://api.pwnedpasswords.com",
  "https://sme.gov.ao",
  "https://api.resend.com",
  "https://www.google-analytics.com",
  "https://analytics.google.com",
  "https://www.googletagmanager.com",
  "https://cloudflareinsights.com",
].join(" ");

// Content Security Policy — bloqueia XSS e injeção de recursos externos
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${process.env.NODE_ENV === "development" ? "'unsafe-eval'" : ""} https://challenges.cloudflare.com https://www.googletagmanager.com https://static.cloudflareinsights.com`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' ${ALLOWED_IMG_SRCS}`,
  `font-src 'self' data:`,
  `connect-src ${ALLOWED_CONNECT_SRCS}`,
  `frame-src https://challenges.cloudflare.com`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS = [
  { key: "X-Frame-Options",              value: "DENY" },
  { key: "X-Content-Type-Options",       value: "nosniff" },
  { key: "Referrer-Policy",              value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control",       value: "on" },
  { key: "Permissions-Policy",           value: "geolocation=(), camera=(), microphone=(), payment=()" },
  { key: "Strict-Transport-Security",    value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  { key: "Cross-Origin-Opener-Policy",   value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "Content-Security-Policy",      value: CSP },
];

const nextConfig: NextConfig = {
  compress: true,
  serverExternalPackages: ["bcryptjs", "qrcode", "web-push"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;