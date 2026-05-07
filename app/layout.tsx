import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "next-auth/react";

export const metadata: Metadata = {
  title: "Dynamics Works — Plataforma de Negociação Angola",
  description: "Plataforma de trading de opções binárias para o mercado angolano. Forex, Crypto, Commodities em Kwanza.",
  icons: [{ url: "/favicon.svg", type: "image/svg+xml" }],
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
