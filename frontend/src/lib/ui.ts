/** Join class names, skipping falsy values. */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

export const container = "mx-auto w-full max-w-6xl px-4 sm:px-6";

export const button =
  "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition " +
  "disabled:cursor-not-allowed disabled:opacity-50";
export const buttonPrimary = cn(
  button,
  "bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200",
);
export const buttonSecondary = cn(
  button,
  "border border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 " +
    "dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-700 dark:hover:bg-zinc-800",
);
export const buttonGhost = cn(
  button,
  "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white",
);

export const input =
  "w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-zinc-900 shadow-sm " +
  "placeholder:text-zinc-400 transition focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 " +
  "dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500";

export const label = "mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300";

export const card =
  "rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60";

export const chip =
  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition " +
  "border-zinc-200 text-zinc-600 hover:border-zinc-300 hover:text-zinc-900 " +
  "dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-white";
export const chipActive =
  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition " +
  "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900";

export const alertError =
  "rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 " +
  "dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300";
export const alertInfo =
  "rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800 " +
  "dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-200";
