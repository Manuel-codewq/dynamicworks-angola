import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "next-auth/react";

const BASE_URL = "https://dynamicworks.ao";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "Dynamics Works — Plataforma de Trading em Angola",
    template: "%s | Dynamics Works",
  },
  description: "Negocia Forex, Cripto e Commodities em Kwanza (AOA) na plataforma de opções binárias líder em Angola. Criada pela Digikap. Depósitos via Multicaixa Express.",
  keywords: [
    "trading Angola", "opções binárias Angola", "forex Angola", "plataforma trading Kwanza",
    "investir Angola", "Multicaixa Express trading", "broker Angola", "Dynamics Works",
    "Digikap", "trading AOA", "bitcoin Angola", "ouro Angola",
  ],
  authors: [{ name: "Digikap", url: BASE_URL }],
  creator: "Digikap",
  publisher: "Dynamics Works",
  category: "finance",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-snippet": -1, "max-image-preview": "large" },
  },
  openGraph: {
    type: "website",
    locale: "pt_AO",
    url: BASE_URL,
    siteName: "Dynamics Works",
    title: "Dynamics Works — Plataforma de Trading em Angola",
    description: "Negocia Forex, Cripto e Commodities em Kwanza na plataforma líder em Angola. Depósitos via Multicaixa Express.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Dynamics Works — Trading em Angola" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Dynamics Works — Trading em Angola",
    description: "Plataforma de opções binárias em Kwanza. Forex, Cripto, Commodities. Criada pela Digikap.",
    images: ["/og-image.png"],
  },
  icons: [
    { url: "/favicon.svg", type: "image/svg+xml" },
    { url: "/icon-192", sizes: "192x192", type: "image/png" },
    { url: "/icon-512", sizes: "512x512", type: "image/png" },
  ],
  manifest: "/manifest.json",
  verification: { google: "1frD-5CSI74OUUeLfAug4yD7hI7AeHT-IEDKLY6-znY" },
  alternates: { canonical: BASE_URL },
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
