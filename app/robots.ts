import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/register", "/terms"],
        disallow: ["/trade", "/wallet", "/dashboard", "/admin", "/api/", "/profile", "/history"],
      },
    ],
    sitemap: "https://dynamicworks.ao/sitemap.xml",
    host:    "https://dynamicworks.ao",
  };
}
