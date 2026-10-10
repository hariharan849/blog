"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
    <ul className="nav nav-pills mb-4">
      {LINKS.map((link) => (
        <li className="nav-item" key={link.href}>
          <Link className={`nav-link${active(link.href) ? " active" : ""}`} href={link.href}>{link.label}</Link>
        </li>
      ))}
    </ul>
  );
}
