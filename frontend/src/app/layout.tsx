import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { profile } from "@/lib/profile";
import { SITE_URL } from "@/lib/format";
import "./globals.css";
// Header and search styles live in their own file so edits at the end of globals.css
// (where new features usually append) can't drop them in a merge.
import "./header-search.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${profile.name} · ${profile.role}`, template: `%s · ${profile.name}` },
  description: profile.intro,
  alternates: { types: { "application/rss+xml": "/rss.xml" } },
  ...(profile.avatar && {
    openGraph: {
      type: "website",
      siteName: profile.name,
      images: [{ url: profile.avatar, width: 480, height: 480, alt: profile.name }],
    },
    twitter: { card: "summary", images: [profile.avatar] },
  }),
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
