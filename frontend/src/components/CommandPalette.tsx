"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { OPEN_PALETTE_EVENT } from "@/lib/palette-events";
import type { SearchResponse, SearchResult, User } from "@/lib/types";
import { cn } from "@/lib/ui";

interface Item {
  id: string;
  kind: "post" | "action";
  title: string;
  subtitle?: string;
  badge?: string | null;
  href: string;
}

function actionsFor(user: User | null, query: string): Item[] {
  const actions: Item[] = [
    { id: "home", kind: "action", title: "Go to all posts", href: "/" },
    { id: "about-h", kind: "action", title: "About Hariharan", href: "/about/hariharan/" },
    { id: "about-r", kind: "action", title: "About Rajan", href: "/about/rajan/" },
  ];
  if (user?.is_staff) actions.push({ id: "bytes", kind: "action", title: "Open Daily Bytes", href: "/bytes/" });
  if (user?.is_superuser) actions.push({ id: "write", kind: "action", title: "Write a new post", href: "/add/" });
  if (!user) actions.push({ id: "login", kind: "action", title: "Sign in", href: "/login/" });

  const q = query.trim().toLowerCase();
  const matching = q ? actions.filter((action) => action.title.toLowerCase().includes(q)) : actions;
  if (q) {
    matching.unshift({
      id: "all-results",
      kind: "action",
      title: `See all results for “${query.trim()}”`,
      href: `/search/?q=${encodeURIComponent(query.trim())}`,
    });
  }
  return matching;
}

function isTypingTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  return !!element && (element.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName));
}

export default function CommandPalette({ user }: { user: User | null }) {
  const router = useRouter();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState<{ q: string; results: SearchResult[] }>({ q: "", results: [] });
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  const show = useCallback(() => {
    returnFocus.current = document.activeElement as HTMLElement | null;
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActive(0);
    returnFocus.current?.focus?.();
  }, []);

  // Global shortcuts: ⌘K / Ctrl+K toggles, "/" opens when not typing; header buttons dispatch an event.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (open) close();
        else show();
      } else if (event.key === "/" && !open && !isTypingTarget(event.target)) {
        event.preventDefault();
        show();
      }
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_PALETTE_EVENT, show);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_PALETTE_EVENT, show);
    };
  }, [open, show, close]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [open]);

  // Debounced search-as-you-type against the hybrid (keyword + semantic) search API.
  const q = query.trim();
  const searching = open && q.length >= 2;
  const results = useMemo(() => (searching ? searched.results : []), [searching, searched]); // previous results stay visible while loading
  const loading = searching && searched.q !== q;

  useEffect(() => {
    if (!searching) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q, mode: "hybrid", limit: "6" });
        const response = await fetch(`/api/v1/search/?${params}`, { signal: controller.signal });
        const found = response.ok ? ((await response.json()) as SearchResponse).results : [];
        setSearched({ q, results: found });
        setActive(0);
      } catch (error) {
        if ((error as Error).name !== "AbortError") setSearched({ q, results: [] });
      }
    }, 200);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [q, searching]);

  const items: Item[] = useMemo(
    () => [
      ...results.map((result) => ({
        id: `post-${result.slug}`,
        kind: "post" as const,
        title: result.title,
        subtitle: result.snippet,
        badge: result.category,
        href: `/post/${result.slug}/`,
      })),
      ...actionsFor(user, query),
    ],
    [results, user, query],
  );

  function go(item: Item | undefined) {
    if (!item) return;
    close();
    router.push(item.href);
  }

  function onInputKey(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => (index + 1) % Math.max(items.length, 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => (index - 1 + items.length) % Math.max(items.length, 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      go(items[active]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  }

  if (!open) return null;

  const postCount = results.length;
  const activeId = items[active] ? `${listId}-${items[active].id}` : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]" role="presentation">
      <div className="absolute inset-0 animate-fade-in bg-zinc-950/40 backdrop-blur-sm" onClick={close} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search posts and commands"
        className="relative w-full max-w-xl animate-pop-in overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl shadow-zinc-950/20 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="flex items-center gap-3 border-b border-zinc-100 px-4 dark:border-zinc-800">
          <svg aria-hidden viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5 shrink-0 text-zinc-500 dark:text-zinc-400">
            <circle cx="9" cy="9" r="6" />
            <path d="m14 14 4 4" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onInputKey}
            placeholder="Search posts or ask a question…"
            className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-zinc-400"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={activeId}
            aria-autocomplete="list"
            aria-label="Search"
          />
          {loading && <span className="size-4 animate-spin rounded-full border-2 border-zinc-300 border-t-indigo-500" aria-label="Searching" />}
          <kbd className="rounded-md border border-zinc-200 px-1.5 py-0.5 font-mono text-[11px] text-zinc-400 dark:border-zinc-700">Esc</kbd>
        </div>
        <ul id={listId} role="listbox" aria-label="Results" className="max-h-[60vh] overflow-y-auto p-2">
          {items.map((item, index) => (
            <li key={item.id}>
              {index === 0 && postCount > 0 && <p className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Posts</p>}
              {index === postCount && <p className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{postCount ? "Actions" : query.trim().length >= 2 && !loading ? "No matching posts · Actions" : "Jump to"}</p>}
              <div
                id={`${listId}-${item.id}`}
                role="option"
                aria-selected={index === active}
                onMouseMove={() => setActive(index)}
                onClick={() => go(item)}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5",
                  index === active ? "bg-zinc-100 dark:bg-zinc-800" : "",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg text-xs",
                    item.kind === "post" ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300" : "bg-zinc-500/10 text-zinc-500",
                  )}
                >
                  {item.kind === "post" ? "¶" : "→"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{item.title}</span>
                    {item.badge && <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-500 dark:bg-zinc-800">{item.badge}</span>}
                  </span>
                  {item.subtitle && <span className="mt-0.5 line-clamp-2 block text-xs text-zinc-500 dark:text-zinc-400">{item.subtitle}</span>}
                </span>
              </div>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-4 border-t border-zinc-100 px-4 py-2.5 text-xs text-zinc-400 dark:border-zinc-800">
          <span><kbd className="font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono">↵</kbd> open</span>
          <span className="ml-auto">Hybrid semantic search</span>
        </div>
      </div>
    </div>
  );
}
