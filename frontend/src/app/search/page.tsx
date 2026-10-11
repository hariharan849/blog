import type { Metadata } from "next";
import Link from "next/link";

import PageHeader from "@/components/PageHeader";
import { ApiError } from "@/lib/errors";
import { apiGet, query } from "@/lib/server-api";
import type { SearchMode, SearchResponse } from "@/lib/types";
import { alertError, buttonPrimary, cn, container, input } from "@/lib/ui";

export const metadata: Metadata = { title: "Search", robots: { index: false } };

const MODES: { value: SearchMode; label: string; hint: string }[] = [
  { value: "hybrid", label: "Smart", hint: "Keywords + meaning" },
  { value: "semantic", label: "By meaning", hint: "Similar ideas" },
  { value: "keyword", label: "Exact words", hint: "Full-text" },
];

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const params = await searchParams;
  const q = (typeof params.q === "string" ? params.q : "").trim();
  const mode = MODES.some((m) => m.value === params.mode) ? (params.mode as SearchMode) : "hybrid";
  let data: SearchResponse | null = null;
  let error = "";
  if (q) {
    try {
      data = await apiGet<SearchResponse>(`/api/v1/search/${query({ q, mode, limit: "20" })}`);
    } catch (err) {
      error = err instanceof ApiError ? err.message : "Search failed.";
    }
  }

  return (
    <>
      <PageHeader eyebrow="Search" title={q ? <>Results for &ldquo;{q}&rdquo;</> : "Search the blog"} narrow>
        <form action="/search/" method="get" className="mt-8 space-y-4">
          <div className="flex gap-2">
            <input type="search" name="q" defaultValue={q} className={cn(input, "py-3 text-base")} aria-label="Search query" placeholder="Ask a question or search by keyword…" />
            <button className={buttonPrimary} type="submit">Search</button>
          </div>
          <fieldset className="flex flex-wrap gap-2">
            <legend className="sr-only">Search mode</legend>
            {MODES.map((m) => (
              <label key={m.value} className="cursor-pointer">
                <input type="radio" name="mode" value={m.value} defaultChecked={m.value === mode} className="peer sr-only" />
                <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 transition peer-checked:border-zinc-900 peer-checked:bg-zinc-900 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500 dark:border-zinc-800 dark:text-zinc-400 dark:peer-checked:border-white dark:peer-checked:bg-white dark:peer-checked:text-zinc-900">
                  {m.label} <span className="text-xs opacity-60">{m.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
        </form>
      </PageHeader>
      <div className={cn(container, "max-w-3xl")}>
        {error && <div className={alertError}>{error}</div>}
        {data && (data.results.length ? (
          <>
            <p className="mb-4 text-sm text-zinc-500">{data.count} {data.count === 1 ? "result" : "results"}</p>
            <ul className="space-y-3">
              {data.results.map((result) => (
                <li key={result.slug}>
                  <Link href={`/post/${result.slug}/`} className="group block animate-fade-in rounded-2xl border border-zinc-200 p-5 transition hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:hover:border-zinc-700">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-serif text-lg font-semibold group-hover:text-indigo-600 dark:group-hover:text-indigo-300">{result.title}</span>
                      {result.category && <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800">{result.category}</span>}
                      {result.matched_by.includes("semantic") && <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-xs text-violet-600 dark:text-violet-300">meaning match</span>}
                    </div>
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{result.snippet}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="rounded-2xl border border-dashed border-zinc-300 p-10 text-center text-zinc-500 dark:border-zinc-700">
            No results found. Try different words or the “By meaning” mode.
          </p>
        ))}
      </div>
    </>
  );
}
