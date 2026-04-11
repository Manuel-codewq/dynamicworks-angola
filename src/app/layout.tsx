import type { Metadata, Viewport } from "next";
import { Outfit, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

const BASE_URL = "https://dynamicworks.ao";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),

  title: {
    default: "DynamicWorks Angola | Plataforma de Trading #1 em Angola",
    template: "%s | DynamicWorks Angola",
  },
  description:
    "DynamicWorks Angola — A plataforma de trading mais popular de Angola. Opera ativos sintéticos 24/7, acumuladores, Rise/Fall com gráficos em tempo real. Modo demo gratuito com $10.000 virtuais. Powered by DIGIKAP.",
  keywords: [
    "trading angola",
    "DynamicWorks",
    "DynamicWorks Angola",
    "DIGIKAP",
    "investimento angola",
    "ativos sinteticos",
    "acumuladores deriv",
    "rise fall",
    "plataforma trading angola",
    "trading online angola",
    "bots trading angola",
    "deriv angola",
    "forex angola",
    "mercado financeiro angola",
    "trading luanda",
  ],
  authors: [{ name: "DynamicWorks / DIGIKAP", url: BASE_URL }],
  creator: "DIGIKAP",
  publisher: "DynamicWorks Angola",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180" },
    ],
  },
  appleWebApp: {
    capable: true,
    title: "DynamicWorks",
    statusBarStyle: "black-translucent",
  },

  // ── Open Graph ──────────────────────────────────────────────────────────────
  openGraph: {
    type: "website",
    url: BASE_URL,
    title: "DynamicWorks Angola | Plataforma de Trading #1 em Angola",
    description:
      "A plataforma de trading mais popular de Angola. Gráficos em tempo real, ativos sintéticos 24/7, modo demo gratuito com $10.000 virtuais. Powered by DIGIKAP.",
    locale: "pt_AO",
    alternateLocale: ["pt_PT", "pt_BR"],
    siteName: "DynamicWorks Angola",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "DynamicWorks Angola — Plataforma de Trading",
        type: "image/png",
      },
    ],
  },

  // ── Twitter / X ─────────────────────────────────────────────────────────────
  twitter: {
    card: "summary_large_image",
    title: "DynamicWorks Angola | Trading Platform #1",
    description:
      "Opera ativos sintéticos 24/7 com gráficos em tempo real. Modo demo gratuito com $10.000 virtuais. Powered by DIGIKAP.",
    images: ["/og-image.png"],
  },

  // ── Canonical & alternates ────────────────────────────────────────────────
  alternates: {
    canonical: BASE_URL,
    languages: {
      "pt-AO": BASE_URL,
      "pt-PT": BASE_URL,
    },
  },

  // ── Verification ─────────────────────────────────────────────────────────
  verification: {
    google: "googleb37d685bd75ceb01",
  },

  // ── Categorização ─────────────────────────────────────────────────────────
  category: "Finance",
};

export const viewport: Viewport = {
  themeColor: "#06090f",
  width: "device-width",
  initialScale: 1.0,
  maximumScale: 1.0,
  userScalable: false,
  viewportFit: "cover",
};

// ── JSON-LD Structured Data ──────────────────────────────────────────────────
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${BASE_URL}/#organization`,
      name: "DynamicWorks Angola",
      url: BASE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${BASE_URL}/og-image.png`,
        width: 1200,
        height: 630,
      },
      description:
        "A plataforma de trading financeiro #1 de Angola. Powered by DIGIKAP.",
      foundingLocation: {
        "@type": "Country",
        name: "Angola",
      },
      sameAs: [],
    },
    {
      "@type": "WebSite",
      "@id": `${BASE_URL}/#website`,
      url: BASE_URL,
      name: "DynamicWorks Angola",
      description: "Plataforma de trading de ativos sintéticos 24/7 em Angola.",
      publisher: { "@id": `${BASE_URL}/#organization` },
      inLanguage: "pt-AO",
      potentialAction: {
        "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: `${BASE_URL}/?q={search_term_string}` },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "WebPage",
      "@id": `${BASE_URL}/#webpage`,
      url: BASE_URL,
      name: "DynamicWorks Angola | Plataforma de Trading #1",
      inLanguage: "pt-AO",
      isPartOf: { "@id": `${BASE_URL}/#website` },
      about: { "@id": `${BASE_URL}/#organization` },
      description:
        "Opera em tempo real com ativos sintéticos disponíveis 24/7. Modo demo gratuito.",
      breadcrumb: {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Início",
            item: BASE_URL,
          },
        ],
      },
    },
    {
      "@type": "SoftwareApplication",
      name: "DynamicWorks Trading Platform",
      operatingSystem: "Web, iOS, Android",
      applicationCategory: "FinanceApplication",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        description: "Modo demo gratuito com $10.000 virtuais",
      },
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: "4.8",
        ratingCount: "1200",
        bestRating: "5",
      },
    },
  ],
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
      <head>
        <Script
          id="json-ld"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

