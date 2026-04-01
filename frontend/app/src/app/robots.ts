import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/pricing", "/login", "/register"],
      disallow: ["/dashboard", "/api"]
    },
    sitemap: "https://secureid.local/sitemap.xml"
  };
}
