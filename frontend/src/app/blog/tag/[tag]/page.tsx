import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPosts, getTags } from "@/lib/posts";
import PostCard from "@/components/PostCard";
import Pagination from "@/components/Pagination";
import { paginate } from "@/lib/paginate";

const PER_PAGE = 10;

type Props = { params: Promise<{ tag: string }>; searchParams: Promise<{ page?: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return getTags().map(({ tag }) => ({ tag }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: `Posts tagged #${(await params).tag}` };
}

export default async function TagPage({ params, searchParams }: Props) {
  const { tag } = await params;
  const tagged = getPosts().filter((p) => p.tags.includes(tag));
  if (!tagged.length) notFound();
  const { items: posts, pager } = paginate(tagged, (await searchParams).page, PER_PAGE);
  return (
    <>
      <section className="hero">
        <p className="eyebrow">Tag</p>
        <h1>#{tag}</h1>
      </section>
      <div className="stack">
        {posts.map((p) => (
          <PostCard key={p.slug} post={p} />
        ))}
      </div>
      <Pagination base={`/blog/tag/${tag}`} noun="posts" {...pager} />
    </>
  );
}
