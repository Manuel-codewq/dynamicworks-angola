import { MetadataRoute } from "next";

const BASE = "https://dynamicworks.ao";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: BASE,              lastModified: new Date(), changeFrequency: "daily",   priority: 1.0 },
    { url: `${BASE}/login`,   lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/register`,lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/trade`,   lastModified: new Date(), changeFrequency: "always",  priority: 0.9 },
    { url: `${BASE}/terms`,   lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
  ];
}
