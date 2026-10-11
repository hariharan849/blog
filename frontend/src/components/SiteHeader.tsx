"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import Logo from "./Logo";
import SearchButton from "./SearchButton";

import { apiRequest } from "@/lib/client-api";
import type { User } from "@/lib/types";
import { buttonPrimary, cn, container } from "@/lib/ui";

function navLinks(user: User | null) {
  return [
    { href: "/", label: "Posts", match: (p: string) => p === "/" || p.startsWith("/post/") || p.startsWith("/category/") || p.startsWith("/tag/") },
    ...(user?.is_staff ? [{ href: "/bytes/", label: "Daily Bytes", match: (p: string) => p.startsWith("/bytes") }] : []),
    { href: "/about/hariharan/", label: "About", match: (p: string) => p.startsWith("/about") },
    ...(user?.is_superuser ? [{ href: "/add/", label: "Write", match: (p: string) => p.startsWith("/add") }] : []),
  ];
}

function UserMenu({ user }: { user: User }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  async function logout() {
    await apiRequest("/api/v1/auth/logout/", "POST");
    setOpen(false);
    router.push("/");
    router.refresh();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${user.name}`}
        className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 text-sm font-semibold uppercase text-white ring-2 ring-white transition hover:scale-105 dark:from-zinc-200 dark:to-zinc-400 dark:text-zinc-900 dark:ring-zinc-950"
      >
        {user.name.slice(0, 1)}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-56 animate-pop-in rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
          <div className="px-3 py-2">
            <p className="text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-zinc-500">{user.email || "Signed in"}</p>
          </div>
          <div className="my-1 h-px bg-zinc-100 dark:bg-zinc-800" />
          {user.is_staff && (
            <Link role="menuitem" href="/admin/" className="block rounded-lg px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800">
              Admin
            </Link>
          )}
          <button role="menuitem" type="button" onClick={logout} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800">
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

export default function SiteHeader({ user }: { user: User | null }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const links = navLinks(user);

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200/70 bg-white/75 backdrop-blur-xl dark:border-zinc-800/70 dark:bg-zinc-950/75">
      <div className={cn(container, "flex h-16 items-center gap-6")}>
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={link.match(pathname) ? "page" : undefined}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm transition",
                link.match(pathname)
                  ? "bg-zinc-100 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-white"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <SearchButton />
          {user ? (
            <UserMenu user={user} />
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Link href="/login/" className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">
                Sign in
              </Link>
              <Link href="/register/" className={buttonPrimary}>Join</Link>
            </div>
          )}
          <button
            type="button"
            className="grid size-9 place-items-center rounded-full text-zinc-600 hover:bg-zinc-100 md:hidden dark:text-zinc-300 dark:hover:bg-zinc-800"
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <svg aria-hidden viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5">
              {mobileOpen ? <path d="M5 5l10 10M15 5 5 15" strokeLinecap="round" /> : <path d="M3 6h14M3 10h14M3 14h14" strokeLinecap="round" />}
            </svg>
          </button>
        </div>
      </div>
      {mobileOpen && (
        <nav aria-label="Mobile" className="animate-pop-in border-t border-zinc-200 px-4 py-3 md:hidden dark:border-zinc-800">
          {links.map((link) => (
            <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)} className="block rounded-lg px-3 py-2.5 text-base hover:bg-zinc-100 dark:hover:bg-zinc-800">
              {link.label}
            </Link>
          ))}
          {!user && (
            <div className="mt-2 flex gap-2 px-3">
              <Link href="/login/" onClick={() => setMobileOpen(false)} className="text-sm">Sign in</Link>
              <span className="text-zinc-300">·</span>
              <Link href="/register/" onClick={() => setMobileOpen(false)} className="text-sm">Join</Link>
            </div>
          )}
        </nav>
      )}
    </header>
  );
}
