import "bootstrap/dist/css/bootstrap.min.css";
import "./globals.css";

import type { Metadata } from "next";

import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import { getCurrentUser } from "@/lib/server-api";

export const metadata: Metadata = {
  metadataBase: process.env.SITE_URL ? new URL(process.env.SITE_URL) : undefined,
  title: { default: "PyChanter", template: "%s | PyChanter" },
  description: "Personal blogs about Python, machine learning and deep learning.",
  alternates: { types: { "text/markdown": "/llms.txt" } },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <html lang="en">
      <body>
        <Navbar user={user} />
        <main className="container py-4">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
