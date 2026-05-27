import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import Script from "next/script";
import SupportWidget from "./components/SupportWidget";
import NotificationToast from "./components/NotificationToast";
import HeartbeatTracker from "./components/HeartbeatTracker";
import PushManager from "./components/PushManager";
import PwaInstallPrompt from "./components/PwaInstallPrompt";

const BASE_URL = "https://dynamicworks.ao";
const TITLE    = "Dynamics Works — Plataforma de Trading em Angola";
const DESC     = "Negocia Forex, Cripto e Metais em Kwanza (AOA) na plataforma de opções binárias líder em Angola. Depósitos via Multicaixa Express. Conta demo grátis com 10.000 Kz virtual.";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default:  TITLE,
    template: "%s | Dynamics Works",
  },
  description: DESC,
  keywords: [
    "trading Angola", "opções binárias Angola", "forex Angola",
    "plataforma trading Kwanza", "investir Angola", "Multicaixa Express trading",
    "broker Angola", "Dynamics Works", "trading AOA", "bitcoin Angola",
    "ouro Angola", "EUR USD Angola", "ganhar dinheiro Angola", "opções binárias",
    "corretora Angola", "trading online Angola", "Luanda trading",
    "pagamentos Kwanza", "depósito Multicaixa", "negociação Angola",
  ],
  authors:   [{ name: "Dynamics Works", url: BASE_URL }],
  creator:   "Dynamics Works",
  publisher: "Dynamics Works",
  category:  "finance",
  robots: {
    index: true, follow: true,
    googleBot: { index: true, follow: true, "max-snippet": -1, "max-image-preview": "large", "max-video-preview": -1 },
  },
  openGraph: {
    type:        "website",
    locale:      "pt_AO",
    url:         BASE_URL,
    siteName:    "Dynamics Works",
    title:       TITLE,
    description: DESC,
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Dynamics Works — Plataforma de Trading em Angola" }],
  },
  twitter: {
    card:        "summary_large_image",
    title:       "Dynamics Works — Trading em Angola",
    description: "Plataforma de opções binárias em Kwanza. Forex, Cripto, Ouro. Depósitos rápidos via USDT (TRC-20).",
    images:      ["/og-image.png"],
  },
  icons: [
    { url: "/favicon.svg", type: "image/svg+xml" },
    { url: "/icon-192",    sizes: "192x192", type: "image/png" },
    { url: "/icon-512",    sizes: "512x512", type: "image/png" },
  ],
  manifest:     "/manifest.json",
  verification: { google: "1frD-5CSI74OUUeLfAug4yD7hI7AeHT-IEDKLY6-znY" },
  alternates:   { canonical: BASE_URL },
  appleWebApp: {
    capable:         true,
    statusBarStyle:  "black-translucent",
    title:           "Dynamics Works",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "theme-color":            "#f5a623",
    "geo.region":             "AO",
    "geo.placename":          "Angola",
    "geo.position":           "-8.839988;13.289437",
    "ICBM":                   "-8.839988, 13.289437",
  },
};

// JSON-LD Structured Data — Google usa isto para rich results
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type":       "Organization",
      "@id":         `${BASE_URL}/#organization`,
      name:          "Dynamics Works",
      url:           BASE_URL,
      logo: {
        "@type":     "ImageObject",
        url:         `${BASE_URL}/icon-512`,
        width:       512,
        height:      512,
      },
      description:   DESC,
      areaServed: {
        "@type": "Country",
        name:    "Angola",
      },
      contactPoint: {
        "@type":            "ContactPoint",
        contactType:        "customer support",
        availableLanguage:  "Portuguese",
      },
    },
    {
      "@type":     "WebSite",
      "@id":       `${BASE_URL}/#website`,
      url:         BASE_URL,
      name:        "Dynamics Works",
      description: DESC,
      publisher:   { "@id": `${BASE_URL}/#organization` },
      inLanguage:  "pt-AO",
      potentialAction: {
        "@type":       "SearchAction",
        target:        `${BASE_URL}/trade?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type":       "FinancialService",
      "@id":         `${BASE_URL}/#service`,
      name:          "Dynamics Works — Opções Binárias",
      url:           BASE_URL,
      description:   "Plataforma de negociação de opções binárias em Kwanza angolano. Forex, Criptomoedas e Metais Preciosos.",
      provider:      { "@id": `${BASE_URL}/#organization` },
      areaServed: {
        "@type": "Country",
        name:    "Angola",
      },
      serviceType:   "Binary Options Trading",
      currenciesAccepted: "AOA",
      availableChannel: {
        "@type":          "ServiceChannel",
        serviceUrl:       BASE_URL,
        availableLanguage: "Portuguese",
      },
    },
    {
      "@type":    "WebPage",
      "@id":      `${BASE_URL}/#webpage`,
      url:        BASE_URL,
      name:       TITLE,
      isPartOf:   { "@id": `${BASE_URL}/#website` },
      about:      { "@id": `${BASE_URL}/#service` },
      description: DESC,
      inLanguage: "pt-AO",
      breadcrumb: {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Início", item: BASE_URL },
        ],
      },
    },
    {
      "@type":     "FAQPage",
      "@id":       `${BASE_URL}/#faq`,
      mainEntity: [
        {
          "@type":          "Question",
          name:             "O que é a Dynamics Works?",
          acceptedAnswer: {
            "@type": "Answer",
            text:    "A Dynamics Works é a primeira plataforma de opções binárias angolana, que permite negociar Forex, Criptomoedas e Metais Preciosos com pagamentos em Kwanza (AOA) via USDT.",
          },
        },
        {
          "@type":          "Question",
          name:             "Como faço um depósito?",
          acceptedAnswer: {
            "@type": "Answer",
            text:    "Os depósitos são feitos em Kwanza angolano (AOA) via USDT (TRC-20). O processo é simples e rápido, diretamente na secção Carteira da plataforma.",
          },
        },
        {
          "@type":          "Question",
          name:             "Existe conta demo gratuita?",
          acceptedAnswer: {
            "@type": "Answer",
            text:    "Sim. Ao registar-se, recebe automaticamente 10.000 Kz virtual para praticar sem risco antes de usar dinheiro real.",
          },
        },
        {
          "@type":          "Question",
          name:             "Quais ativos posso negociar?",
          acceptedAnswer: {
            "@type": "Answer",
            text:    "Pode negociar mais de 16 ativos: pares Forex (EUR/USD, GBP/USD, etc.), Criptomoedas (BTC/USD, ETH/USD) e Metais Preciosos (XAU/USD, XAG/USD).",
          },
        },
      ],
    },
  ],
};

const GA_ID = "G-CQY1V53058";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-AO" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body style={{ margin: 0, padding: 0, background: "#0a0f1e" }} suppressHydrationWarning>
        <SessionProvider>
          {children}
          <HeartbeatTracker />
          <SupportWidget />
          <NotificationToast />
          <PushManager />
          <PwaInstallPrompt />
        </SessionProvider>

        {/* PWA Service Worker */}
        <Script id="sw-register" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
            }
          `}
        </Script>

        {/* Google Analytics 4 — carrega após interacção para não penalizar performance */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          strategy="afterInteractive"
        />
        <Script id="ga4-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_ID}', {
              page_path: window.location.pathname,
              anonymize_ip: true
            });
          `}
        </Script>
      </body>
    </html>
  );
}
