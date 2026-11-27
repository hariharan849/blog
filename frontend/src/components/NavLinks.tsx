"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/", label: "Home" },
  { href: "/projects", label: "Projects" },
  { href: "/blog", label: "Blog" },
  { href: "/articles", label: "Articles" },
  { href: "/daily", label: "Daily Dose" },
  { href: "/about", label: "About" },
];

export default function NavLinks() {
  const path = usePathname() ?? "/";
  return (
    <nav className="nav" aria-label="Main">
      {nav.map((n) => {
        const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
        return (
          <Link key={n.href} href={n.href} className={active ? "active" : undefined} aria-current={active ? "page" : undefined}>
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
