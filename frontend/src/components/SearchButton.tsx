"use client";

import { useSyncExternalStore } from "react";

import { openCommandPalette } from "@/lib/palette-events";
import { cn } from "@/lib/ui";

const noop = () => () => {};

export function useShortcutLabel() {
  // The platform is only known in the browser; the server render shows ⌘K.
  return useSyncExternalStore(
    noop,
    () => (/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K"),
    () => "⌘K",
  );
}

export default function SearchButton({ className, wide = false }: { className?: string; wide?: boolean }) {
  const shortcut = useShortcutLabel();
  return (
    <button
      type="button"
      onClick={openCommandPalette}
      aria-label="Search posts"
      aria-keyshortcuts="Control+K Meta+K"
      className={cn(
        "flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 text-sm text-zinc-500 transition hover:border-zinc-300 hover:text-zinc-700",
        "dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-200",
        wide ? "w-full max-w-md px-4 py-3" : "px-3 py-1.5",
        className,
      )}
    >
      <svg aria-hidden viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4">
        <circle cx="9" cy="9" r="6" />
        <path d="m14 14 4 4" strokeLinecap="round" />
      </svg>
      <span className={wide ? "flex-1 text-left" : "hidden sm:inline"}>{wide ? "Search posts or ask a question…" : "Search"}</span>
      <kbd className="hidden rounded-md border border-zinc-200 bg-white px-1.5 py-0.5 font-mono text-[11px] text-zinc-500 sm:inline dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
        {shortcut}
      </kbd>
    </button>
  );
}
