import { MetadataRoute } from "next";

const BASE = "https://dynamicworks.ao";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: BASE,                lastModified: new Date(), changeFrequency: "daily",   priority: 1.0 },
    { url: `${BASE}/register`,  lastModified: new Date(), changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/login`,     lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/ranking`,   lastModified: new Date(), changeFrequency: "daily",   priority: 0.6 },
    { url: `${BASE}/terms`,     lastModified: new Date(), changeFrequency: "yearly",  priority: 0.3 },
  ];
}
