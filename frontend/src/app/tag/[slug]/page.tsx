import type { Metadata } from "next";
import { api, safe } from "@/lib/api";
import PostList from "@/components/PostList";
import Pagination from "@/components/Pagination";
import Sidebar from "@/components/Sidebar";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: `Posts tagged #${(await params).slug}` };
}

export default async function TagPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const [data, tags] = await Promise.all([
    safe(api.posts({ tag: slug, page }), null),
    safe(api.tags(), []),
  ]);
  const name = tags.find((t) => t.slug === slug)?.name ?? slug;

  return (
    <div className="layout">
      <div>
        <section className="hero">
          <p className="eyebrow">Tag</p>
          <h1>#{name}</h1>
        </section>
        <PostList posts={data?.results ?? []} empty="No posts with this tag yet." />
        {data && <Pagination page={data.page} numPages={data.num_pages} basePath={`/tag/${slug}`} />}
      </div>
      <Sidebar />
    </div>
  );
}
