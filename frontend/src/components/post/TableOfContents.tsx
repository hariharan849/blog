"use client";

import { useEffect, useState } from "react";

import type { TocEntry } from "@/lib/toc";
import { cn } from "@/lib/ui";

/** Sticky "On this page" list that highlights the section currently being read. */
export default function TableOfContents({ entries }: { entries: TocEntry[] }) {
  const [active, setActive] = useState(entries[0]?.id ?? "");

  useEffect(() => {
    const headings = entries
      .map((entry) => document.getElementById(entry.id))
      .filter((element): element is HTMLElement => element !== null);
    if (!headings.length) return;
    const observer = new IntersectionObserver(
      (observed) => {
        const visible = observed
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -65% 0px" },
    );
    headings.forEach((heading) => observer.observe(heading));
    return () => observer.disconnect();
  }, [entries]);

  if (!entries.length) return null;

  return (
    <nav aria-label="On this page">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">On this page</p>
      <ul className="space-y-1 border-l border-zinc-200 dark:border-zinc-800">
        {entries.map((entry) => (
          <li key={entry.id}>
            <a
              href={`#${entry.id}`}
              aria-current={active === entry.id ? "location" : undefined}
              className={cn(
                "-ml-px block border-l py-1 text-sm transition",
                entry.level === 3 ? "pl-6" : "pl-3",
                active === entry.id
                  ? "border-indigo-500 font-medium text-zinc-900 dark:text-white"
                  : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200",
              )}
            >
              {entry.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
