import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { profile } from "@/lib/profile";
import { SITE_URL } from "@/lib/format";
import "./globals.css";
// Header and search styles live in their own file so edits at the end of globals.css
// (where new features usually append) can't drop them in a merge.
import "./header-search.css";
import "./code-highlight.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${profile.name} · ${profile.role}`, template: `%s · ${profile.name}` },
  description: profile.intro,
  alternates: { types: { "application/rss+xml": "/rss.xml" } },
  // Link-preview images come from the opengraph-image.tsx files (site-wide, per post, per lesson).
  openGraph: { type: "website", siteName: profile.name },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Header />
        <main className="container main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
