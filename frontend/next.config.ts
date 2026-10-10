import type { NextConfig } from "next";

// Django runs next to Next.js (same container in production). Everything that isn't a page is
// forwarded to it, so the browser only ever talks to one origin: session cookies and CSRF just work.
const BACKEND_URL = (process.env.BACKEND_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
    : []),
];

const nextConfig: NextConfig = {
  output: "standalone",
  // Django URLs end in "/"; keep the same convention so proxied paths never bounce between redirects.
  trailingSlash: true,
  poweredByHeader: false,
  async rewrites() {
    return {
      beforeFiles: [
        // API and admin URLs end with a slash (trailingSlash: true requires it in source and destination).
        { source: "/api/:path*/", destination: `${BACKEND_URL}/api/:path*/` },
        { source: "/admin/", destination: `${BACKEND_URL}/admin/` },
        { source: "/admin/:path*/", destination: `${BACKEND_URL}/admin/:path*/` },
        // Files (admin assets, uploaded images) have extensions, so no trailing slash.
        { source: "/static/:path*", destination: `${BACKEND_URL}/static/:path*` },
        { source: "/media/:path*", destination: `${BACKEND_URL}/media/:path*` },
        { source: "/sitemap.xml", destination: `${BACKEND_URL}/sitemap.xml` },
        { source: "/robots.txt", destination: `${BACKEND_URL}/robots.txt` },
        { source: "/llms.txt", destination: `${BACKEND_URL}/llms.txt` },
      ],
    };
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
