"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/ui";

const LINKS = [
  { href: "/bytes/", label: "Today" },
  { href: "/bytes/articles/", label: "All articles" },
  { href: "/bytes/archive/", label: "Archive" },
  { href: "/bytes/sources/", label: "Sources & interests" },
];

export default function BytesNav() {
  const pathname = usePathname();
  const active = (href: string) =>
    href === "/bytes/" ? pathname === "/bytes/" || /^\/bytes\/\d{4}-\d{2}-\d{2}\/?$/.test(pathname) : pathname.startsWith(href);
  return (
    <nav aria-label="Daily Bytes" className="flex w-fit flex-wrap rounded-full border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-900">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={active(link.href) ? "page" : undefined}
          className={cn(
            "rounded-full px-3.5 py-1.5 text-sm transition",
            active(link.href)
              ? "bg-white font-medium text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-white"
              : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white",
          )}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
