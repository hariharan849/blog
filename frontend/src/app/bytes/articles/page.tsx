import Link from "next/link";

import Pagination from "@/components/Pagination";
import ArticleCard from "@/components/bytes/ArticleCard";
import { apiGet, query } from "@/lib/server-api";
import type { Article, Page, Source } from "@/lib/types";
import { buttonPrimary, card, cn, input } from "@/lib/ui";

export const metadata = { title: "Articles" };

const FILTERS = ["q", "tag", "source", "starred", "unread"] as const;

export default async function ArticlesPage({ searchParams }: PageProps<"/bytes/articles">) {
  const params = await searchParams;
  const filters: Record<string, string> = {};
  for (const key of FILTERS) {
    const value = params[key];
    if (typeof value === "string" && value) filters[key] = value;
  }
  const page = typeof params.page === "string" ? params.page : undefined;
  const [articles, sources] = await Promise.all([
    apiGet<Page<Article>>(`/api/v1/bytes/articles/${query({ ...filters, page })}`, { withCookies: true }),
    apiGet<Source[]>("/api/v1/bytes/sources/", { withCookies: true }),
  ]);

  return (
    <>
      <form action="/bytes/articles/" method="get" className={cn(card, "mb-6 flex flex-wrap items-center gap-3 p-3")}>
        <input type="search" name="q" defaultValue={filters.q} className={cn(input, "min-w-48 flex-1")} placeholder="Search titles and summaries" aria-label="Search articles" />
        <select name="source" defaultValue={filters.source ?? ""} className={cn(input, "w-auto")} aria-label="Source">
          <option value="">All sources</option>
          {sources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="starred" value="1" defaultChecked={!!filters.starred} className="accent-indigo-600" /> Starred</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="unread" value="1" defaultChecked={!!filters.unread} className="accent-indigo-600" /> Unread</label>
        {filters.tag && <input type="hidden" name="tag" value={filters.tag} />}
        <button className={buttonPrimary} type="submit">Filter</button>
      </form>
      {filters.tag && (
        <p className="mb-4 text-sm">Tag <strong>#{filters.tag}</strong> · <Link href="/bytes/articles/" className="text-indigo-600 dark:text-indigo-400">clear</Link></p>
      )}
      <div className="space-y-4">
        {articles.results.length ? (
          articles.results.map((article) => <ArticleCard key={article.id} article={article} />)
        ) : (
          <p className="rounded-2xl border border-dashed border-zinc-300 p-10 text-center text-zinc-500 dark:border-zinc-700">No articles match.</p>
        )}
      </div>
      <Pagination page={articles.page} numPages={articles.num_pages} basePath="/bytes/articles/" params={filters} />
    </>
  );
}
