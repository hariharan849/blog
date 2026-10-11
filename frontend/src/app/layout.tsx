import "@fontsource-variable/fraunces";
import "./globals.css";

import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata, Viewport } from "next";

import CommandPalette from "@/components/CommandPalette";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { getCurrentUser } from "@/lib/server-api";

export const metadata: Metadata = {
  metadataBase: process.env.SITE_URL ? new URL(process.env.SITE_URL) : undefined,
  title: { default: "PyChanter", template: "%s · PyChanter" },
  description: "Notes on deep learning, machine learning and building with AI, by Hariharan Manoharan and Rajan Singh.",
  alternates: { types: { "text/markdown": "/llms.txt" } },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="flex min-h-screen flex-col bg-white font-sans text-zinc-900 antialiased dark:bg-zinc-950 dark:text-zinc-100">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:shadow">
          Skip to content
        </a>
        <SiteHeader user={user} />
        <main id="main" className="flex-1">{children}</main>
        <SiteFooter />
        <CommandPalette user={user} />
      </body>
    </html>
  );
}
