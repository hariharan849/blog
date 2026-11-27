import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPost, getPosts } from "@/lib/posts";
import { formatDate, SITE_URL } from "@/lib/format";
import ShareLinks from "@/components/ShareLinks";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return getPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = getPost((await params).slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.summary,
    openGraph: { type: "article", title: post.title, description: post.summary, publishedTime: post.date },
  };
}

export default async function PostPage({ params }: Props) {
  const post = getPost((await params).slug);
  if (!post) notFound();

  return (
    <article className="narrow">
      <header className="hero">
        <p className="meta">
          <time dateTime={post.date}>{formatDate(post.date, { month: "long" })}</time> · {post.readingMinutes} min read
          {post.draft && <span className="badge badge-warn">Draft</span>}
        </p>
        <h1 className="post-title">{post.title}</h1>
        {post.tags.length > 0 && (
          <p className="tag-row">
            {post.tags.map((t) => (
              <Link key={t} href={`/blog/tag/${t}`} className="badge badge-muted">
                #{t}
              </Link>
            ))}
          </p>
        )}
      </header>
      {/* Posts are Markdown files committed to this repo by the site owner. */}
      <div className="prose" dangerouslySetInnerHTML={{ __html: post.html }} />
      <hr />
      <ShareLinks title={post.title} url={`${SITE_URL}/blog/${post.slug}`} />
      <Link href="/blog" className="button button-secondary">
        ← All posts
      </Link>
    </article>
  );
}
