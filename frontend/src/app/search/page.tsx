import type { Metadata } from "next";
import { api, safe } from "@/lib/api";
import PostList from "@/components/PostList";
import Pagination from "@/components/Pagination";
import SearchForm from "@/components/SearchForm";

type Props = { searchParams: Promise<{ q?: string; page?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = await searchParams;
  return { title: q ? `Search: ${q}` : "Search" };
}

export default async function SearchPage({ searchParams }: Props) {
  const { q = "", page } = await searchParams;
  const query = q.trim();
  const pageNum = Math.max(1, Number(page) || 1);
  const data = query ? await safe(api.posts({ q: query, page: pageNum }), null) : null;

  return (
    <div className="narrow">
      <section className="hero">
        <h1>{query ? <>Search results for &ldquo;{query}&rdquo;</> : "Search"}</h1>
        {data && (
          <p className="muted">
            {data.count} {data.count === 1 ? "post" : "posts"} found
          </p>
        )}
        <SearchForm defaultValue={query} />
      </section>
      {query && (
        <>
          <PostList posts={data?.results ?? []} empty="No posts found." />
          {data && (
            <Pagination page={data.page} numPages={data.num_pages} basePath="/search" params={{ q: query }} />
          )}
        </>
      )}
    </div>
  );
}
