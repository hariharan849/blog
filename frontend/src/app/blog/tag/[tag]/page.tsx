import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPosts, getTags } from "@/lib/posts";
import PostCard from "@/components/PostCard";

type Props = { params: Promise<{ tag: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return getTags().map(({ tag }) => ({ tag }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: `Posts tagged #${(await params).tag}` };
}

export default async function TagPage({ params }: Props) {
  const { tag } = await params;
  const posts = getPosts().filter((p) => p.tags.includes(tag));
  if (!posts.length) notFound();
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
    </>
  );
}
