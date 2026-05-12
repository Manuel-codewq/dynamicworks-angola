import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";

const BASE_URL = "https://dynamicworks.ao";

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
): Promise<Metadata> {
  const { id } = await params;

  let t: {
    id: string; name: string; description: string | null;
    prizePool: number; startDate: Date; endDate: Date;
    status: string; isFree: boolean; entryFee: number;
    prizes: unknown;
    _count: { participants: number };
  } | null = null;

  try {
    t = await prisma.tournament.findUnique({
      where: { id },
      select: {
        id: true, name: true, description: true,
        prizePool: true, startDate: true, endDate: true,
        status: true, isFree: true, entryFee: true, prizes: true,
        _count: { select: { participants: true } },
      },
    });
  } catch { /* DB unreachable — usa fallback */ }

  if (!t) {
    return {
      title:       "Torneio de Trading",
      description: "Participa nos torneios de trading da Dynamics Works Angola com prémios em Kwanza.",
      robots:      { index: true, follow: true },
    };
  }

  const url         = `${BASE_URL}/tournaments/${id}`;
  const prizeStr    = t.prizePool > 0 ? `${t.prizePool.toLocaleString("pt-PT")} Kz em prémios` : "entrada gratuita";
  const statusLabel = { active: "A decorrer", upcoming: "Em breve", finished: "Terminado" }[t.status] ?? "";
  const startFmt    = t.startDate.toLocaleDateString("pt-AO", { day: "2-digit", month: "long", year: "numeric" });
  const endFmt      = t.endDate.toLocaleDateString("pt-AO",   { day: "2-digit", month: "long", year: "numeric" });

  const desc = t.description
    ? `${t.description} — ${prizeStr}. ${statusLabel}. De ${startFmt} a ${endFmt}.`
    : `Torneio de opções binárias em Angola com ${prizeStr}. ${statusLabel}. De ${startFmt} a ${endFmt}. Compete com os melhores traders angolanos na Dynamics Works.`;

  return {
    title:       `${t.name} — Torneio de Trading Angola`,
    description: desc,
    keywords: [
      t.name,
      "torneio trading Angola",
      "competição forex Angola",
      "torneio opções binárias",
      "prémios trading Angola",
      "Dynamics Works torneio",
      "ranking traders Angola",
      "trading Kwanza AOA",
    ],
    alternates: { canonical: url },
    robots: {
      index:     true,
      follow:    true,
      googleBot: { index: true, follow: true, "max-snippet": -1, "max-image-preview": "large" },
    },
    openGraph: {
      type:        "website",
      title:       `${t.name} | Dynamics Works Angola`,
      description: desc,
      url,
      siteName:    "Dynamics Works",
      locale:      "pt_AO",
      images: [{ url: "/og-image.png", width: 1200, height: 630, alt: `${t.name} — Dynamics Works Angola` }],
    },
    twitter: {
      card:        "summary_large_image",
      title:       `${t.name} | Dynamics Works`,
      description: desc,
      images:      ["/og-image.png"],
    },
  };
}

export default async function TournamentDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let t: {
    id: string; name: string; description: string | null;
    prizePool: number; startDate: Date; endDate: Date;
    status: string; isFree: boolean; entryFee: number;
    prizes: unknown;
    _count: { participants: number };
  } | null = null;

  try {
    t = await prisma.tournament.findUnique({
      where: { id },
      select: {
        id: true, name: true, description: true,
        prizePool: true, startDate: true, endDate: true,
        status: true, isFree: true, entryFee: true, prizes: true,
        _count: { select: { participants: true } },
      },
    });
  } catch { /* silencioso */ }

  const url = `${BASE_URL}/tournaments/${id}`;

  const jsonLd = t ? {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Início",           item: BASE_URL },
          { "@type": "ListItem", position: 2, name: "Ranking & Torneios", item: `${BASE_URL}/ranking` },
          { "@type": "ListItem", position: 3, name: t.name,              item: url },
        ],
      },
      {
        "@type":       "Event",
        "@id":         `${url}#event`,
        name:          t.name,
        description:   t.description ?? `Torneio de opções binárias Angola com ${t.prizePool.toLocaleString("pt-PT")} Kz em prémios.`,
        url,
        startDate:     t.startDate.toISOString(),
        endDate:       t.endDate.toISOString(),
        eventStatus:   t.status === "finished"
          ? "https://schema.org/EventCompleted"
          : "https://schema.org/EventScheduled",
        eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
        location: {
          "@type": "VirtualLocation",
          url,
        },
        organizer: {
          "@type": "Organization",
          name:    "Dynamics Works",
          url:     BASE_URL,
        },
        offers: {
          "@type":       "Offer",
          price:         t.isFree ? "0" : String(t.entryFee),
          priceCurrency: "AOA",
          availability:  t.status === "finished"
            ? "https://schema.org/SoldOut"
            : "https://schema.org/InStock",
          url,
        },
        ...(t.prizePool > 0 ? {
          prize: `${t.prizePool.toLocaleString("pt-PT")} Kz`,
        } : {}),
      },
    ],
  } : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {children}
    </>
  );
}
