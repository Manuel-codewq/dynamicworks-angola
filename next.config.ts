import type { NextConfig } from "next";

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
];

const nextConfig: NextConfig = {
  compress: true,
  serverExternalPackages: ["bcryptjs", "qrcode", "web-push"],
  env: {
    NEXT_PUBLIC_TWELVEDATA_API_KEY: process.env.TWELVEDATA_API_KEY ?? "",
  },
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