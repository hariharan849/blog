import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/format";

/** /robots.txt: crawl everything public, skip admin, auth and search-result pages. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/search"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
