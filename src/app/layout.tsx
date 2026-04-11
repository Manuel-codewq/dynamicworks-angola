import type { Metadata, Viewport } from "next";
import { Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "DynamicWorks Angola | Powered by DIGIKAP",
  description: "DynamicWorks Angola — Plataforma de trading #1 em Angola. Powered by DIGIKAP. Gráficos em tempo real, operações com ativos sintéticos 24/7.",
  keywords: "trading, DynamicWorks, DynamicWorks Angola, DIGIKAP, investimento angola, bots automaticos",
  authors: [{ name: "DynamicWorks" }],
  robots: "index, follow",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "DynamicWorks",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    type: "website",
    url: "https://dynamicworks.ao",
    title: "DynamicWorks Angola | Powered by DIGIKAP",
    description: "A plataforma de trading #1 dos angolanos. Powered by DIGIKAP. Opera em tempo real com ativos sintéticos disponíveis 24/7.",
    locale: "pt_AO",
    siteName: "DynamicWorks",
  },
  twitter: {
    card: "summary_large_image",
    title: "DynamicWorks Angola | Powered by DIGIKAP",
    description: "Plataforma de trading #1 em Angola. Powered by DIGIKAP. Modo demo gratuito com $10,000 virtuais.",
  },
};

export const viewport: Viewport = {
  themeColor: "#06090f",
  width: "device-width",
  initialScale: 1.0,
  maximumScale: 1.0,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-AO"
      className={`${outfit.variable} ${jetbrainsMono.variable} antialiased`}
    >
      <body>{children}</body>
    </html>
  );
}
