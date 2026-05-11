import type { Metadata } from "next";

const BASE_URL = "https://dynamicworks.ao";

export const metadata: Metadata = {
  title: "Ranking & Torneios de Trading",
  description:
    "Vê o top dos melhores traders de Angola na Dynamics Works. Classificação em tempo real por lucro, vitórias e taxa de acerto. Participa nos torneios com prémios em Kwanza (AOA) e compete pelos primeiros lugares.",
  keywords: [
    "ranking traders Angola",
    "melhores traders Angola",
    "torneios trading Angola",
    "competição trading Angola",
    "top traders Dynamics Works",
    "classificação traders forex",
    "torneio opções binárias Angola",
    "prémios trading Angola",
    "ranking forex Angola",
    "torneio Kwanza AOA",
    "trading competição Luanda",
    "broker Angola torneios",
  ],
  alternates: { canonical: `${BASE_URL}/ranking` },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-snippet": -1, "max-image-preview": "large" },
  },
  openGraph: {
    type:        "website",
    title:       "Ranking de Traders & Torneios — Dynamics Works Angola",
    description: "Os melhores traders de Angola em tempo real. Participa nos torneios com prémios em Kwanza e sobe no ranking global.",
    url:         `${BASE_URL}/ranking`,
    siteName:    "Dynamics Works",
    locale:      "pt_AO",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Ranking & Torneios — Dynamics Works Angola" }],
  },
  twitter: {
    card:        "summary_large_image",
    title:       "Ranking & Torneios — Dynamics Works Angola",
    description: "Top traders de Angola. Torneios com prémios em Kwanza. Compete e sobe no ranking.",
    images:      ["/og-image.png"],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type":       "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Início",           item: BASE_URL },
        { "@type": "ListItem", position: 2, name: "Ranking & Torneios", item: `${BASE_URL}/ranking` },
      ],
    },
    {
      "@type":       "WebPage",
      "@id":         `${BASE_URL}/ranking#webpage`,
      url:           `${BASE_URL}/ranking`,
      name:          "Ranking de Traders & Torneios de Trading em Angola",
      description:   "Classificação em tempo real dos melhores traders angolanos na plataforma Dynamics Works. Torneios com prémios em Kwanza.",
      isPartOf:      { "@id": `${BASE_URL}/#website` },
      inLanguage:    "pt-AO",
    },
    {
      "@type":       "Event",
      "@id":         `${BASE_URL}/ranking#tournament-series`,
      name:          "Torneios de Trading — Dynamics Works Angola",
      description:   "Série de torneios de opções binárias com prémios em Kwanza angolano. Compete com os melhores traders de Angola.",
      url:           `${BASE_URL}/ranking`,
      eventStatus:   "https://schema.org/EventScheduled",
      eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
      location: {
        "@type": "VirtualLocation",
        url:     `${BASE_URL}/ranking`,
      },
      organizer: {
        "@type": "Organization",
        name:    "Dynamics Works",
        url:     BASE_URL,
      },
      offers: {
        "@type":       "Offer",
        price:         "0",
        priceCurrency: "AOA",
        availability:  "https://schema.org/InStock",
        url:           `${BASE_URL}/ranking`,
      },
    },
  ],
};

export default function RankingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  );
}
