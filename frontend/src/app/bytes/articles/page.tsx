import Link from "next/link";

import Pagination from "@/components/Pagination";
import ArticleCard from "@/components/bytes/ArticleCard";
import { apiGet, query } from "@/lib/server-api";
import type { Article, Page, Source } from "@/lib/types";

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
      <form action="/bytes/articles/" method="get" className="row g-2 mb-3">
        <div className="col-md-4">
          <input type="search" name="q" defaultValue={filters.q} className="form-control" placeholder="Search titles and summaries" aria-label="Search articles" />
        </div>
        <div className="col-md-3">
          <select name="source" defaultValue={filters.source ?? ""} className="form-select" aria-label="Source">
            <option value="">All sources</option>
            {sources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}
          </select>
        </div>
        <div className="col-md-3 d-flex align-items-center gap-3">
          <label><input type="checkbox" name="starred" value="1" defaultChecked={!!filters.starred} /> Starred</label>
          <label><input type="checkbox" name="unread" value="1" defaultChecked={!!filters.unread} /> Unread</label>
        </div>
        {filters.tag && <input type="hidden" name="tag" value={filters.tag} />}
        <div className="col-md-2">
          <button className="btn btn-primary w-100" type="submit">Filter</button>
        </div>
      </form>
      {filters.tag && (
        <p>Tag: <strong>#{filters.tag}</strong> · <Link href="/bytes/articles/">clear</Link></p>
      )}
      {articles.results.length ? (
        articles.results.map((article) => <ArticleCard key={article.id} article={article} />)
      ) : (
        <p className="text-muted">No articles match.</p>
      )}
      <Pagination page={articles.page} numPages={articles.num_pages} basePath="/bytes/articles/" params={filters} />
    </>
  );
}
