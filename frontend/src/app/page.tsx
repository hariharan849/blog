import { api, safe } from "@/lib/api";
import { profile } from "@/lib/profile";
import PostList from "@/components/PostList";
import Pagination from "@/components/Pagination";
import Sidebar from "@/components/Sidebar";

type Props = { searchParams: Promise<{ page?: string }> };

export default async function HomePage({ searchParams }: Props) {
  const { page } = await searchParams;
  const pageNum = Math.max(1, Number(page) || 1);
  const data = await safe(api.posts({ page: pageNum }), null);

  return (
    <div className="layout">
      <div>
        <section className="hero">
          <h1>My Thoughts and Posts</h1>
          <p className="muted">{profile.role}</p>
        </section>

        {data ? (
          <>
            <PostList posts={data.results} />
            <Pagination page={data.page} numPages={data.num_pages} basePath="/" />
          </>
        ) : (
          <p className="muted empty">Couldn&apos;t reach the blog API. Please try again shortly.</p>
        )}
      </div>
      <Sidebar />
    </div>
  );
}
