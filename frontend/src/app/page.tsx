import Link from "next/link";
import { api, safe } from "@/lib/api";
import { getProfile, profiles } from "@/lib/authors";
import PostList from "@/components/PostList";
import Pagination from "@/components/Pagination";
import Sidebar from "@/components/Sidebar";

type Props = { searchParams: Promise<{ author?: string; page?: string }> };

export default async function HomePage({ searchParams }: Props) {
  const { author, page } = await searchParams;
  const pageNum = Math.max(1, Number(page) || 1);
  const data = await safe(api.posts({ author, page: pageNum }), null);
  const profile = getProfile(author);

  return (
    <div className="layout">
      <div>
        <section className="hero">
          <h1>{profile ? `${profile.shortName}'s Blog` : "My Thoughts and Posts"}</h1>
          <p className="muted">{profile ? profile.role : "Deep learning, VFX pipelines and software craft."}</p>
          <div className="author-tabs" role="tablist" aria-label="Filter by author">
            <Link href="/" className={!author ? "active" : ""} aria-current={!author ? "page" : undefined}>
              Everyone
            </Link>
            {profiles.map((p) => {
              const active = author?.toLowerCase() === p.username;
              return (
                <Link
                  key={p.username}
                  href={`/?author=${p.username}`}
                  className={active ? "active" : ""}
                  aria-current={active ? "page" : undefined}
                >
                  {p.shortName}
                </Link>
              );
            })}
          </div>
        </section>

        {data ? (
          <>
            <PostList posts={data.results} />
            <Pagination page={data.page} numPages={data.num_pages} basePath="/" params={{ author }} />
          </>
        ) : (
          <p className="muted empty">Couldn&apos;t reach the blog API. Please try again shortly.</p>
        )}
      </div>
      <Sidebar />
    </div>
  );
}
