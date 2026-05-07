import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "next-auth/react";

export const metadata: Metadata = {
  title: "Dynamics Works — Plataforma de Negociação Angola",
  description: "Plataforma de trading de opções binárias para o mercado angolano. Forex, Crypto, Commodities em Kwanza.",
  icons: [
    { url: "/favicon.svg", type: "image/svg+xml" },
    { url: "/icon-192", sizes: "192x192", type: "image/png" },
    { url: "/icon-512", sizes: "512x512", type: "image/png" },
  ],
  manifest: "/manifest.json",
  verification: { google: "1frD-5CSI74OUUeLfAug4yD7hI7AeHT-IEDKLY6-znY" },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Dynamics Works",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "theme-color": "#f5a623",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <body style={{ margin: 0, padding: 0, background: "#0a0f1e" }}>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
