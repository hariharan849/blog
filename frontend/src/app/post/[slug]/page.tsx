import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import CommentSection from "@/components/CommentSection";
import PostCover from "@/components/PostCover";
import CodeCopy from "@/components/post/CodeCopy";
import ReadingProgress from "@/components/post/ReadingProgress";
import ShareLinks from "@/components/post/ShareLinks";
import TableOfContents from "@/components/post/TableOfContents";
import { formatDate, jsonLd } from "@/lib/format";
import { apiGet, apiGetOrNull, getCurrentUser } from "@/lib/server-api";
import { withHeadingIds } from "@/lib/toc";
import type { Comment, PostDetail } from "@/lib/types";
import { cn, container } from "@/lib/ui";

async function getPost(slug: string) {
  return apiGetOrNull<PostDetail>(`/api/v1/posts/${encodeURIComponent(slug)}/`);
}

export async function generateMetadata({ params }: PageProps<"/post/[slug]">): Promise<Metadata> {
  const post = await getPost((await params).slug);
  if (!post) return { title: "Post not found" };
  return {
    title: post.title,
    description: post.summary.slice(0, 160),
    alternates: { canonical: post.url },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.summary.slice(0, 200),
      url: post.url,
      publishedTime: post.published_at,
      images: post.image ? [post.image] : undefined,
    },
  };
}

export default async function PostPage({ params }: PageProps<"/post/[slug]">) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();
  const [comments, user] = await Promise.all([
    apiGet<Comment[]>(`/api/v1/posts/${encodeURIComponent(slug)}/comments/`),
    getCurrentUser(),
  ]);
  // Content is sanitised server-side (nh3) when saved; we only add heading ids for the TOC.
  const { html, toc } = withHeadingIds(post.content_html);

  return (
    <>
      <ReadingProgress targetId="article-body" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(post.structured_data) }} />

      <header className={cn(container, "max-w-3xl pb-10 pt-14 text-center sm:pt-20")}>
        <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
          {post.category && post.category_slug && (
            <Link href={`/category/${post.category_slug}/`} className="rounded-full bg-indigo-500/10 px-3 py-1 font-medium text-indigo-600 hover:bg-indigo-500/20 dark:text-indigo-300">
              {post.category}
            </Link>
          )}
          <span className="text-zinc-500">{post.reading_minutes} min read</span>
        </div>
        <h1 className="mt-5 font-serif text-4xl font-semibold leading-tight tracking-tight text-balance sm:text-5xl">{post.title}</h1>
        {post.summary && <p className="mx-auto mt-5 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">{post.summary}</p>}
        <div className="mt-8 flex items-center justify-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 font-semibold text-white">
            {post.author.slice(0, 1).toUpperCase()}
          </span>
          <div className="text-left text-sm">
            <p className="font-medium">{post.author}</p>
            <p className="text-zinc-500">
              <time dateTime={post.published_at}>{formatDate(post.published_at)}</time>
            </p>
          </div>
        </div>
      </header>

      <div className={cn(container, "max-w-5xl")}>
        <div className={cn("overflow-hidden rounded-3xl", post.image ? "aspect-[21/9]" : "aspect-[4/1]")}>
          <PostCover seed={post.slug} image={post.image} large />
        </div>
      </div>

      <div className={cn(container, "max-w-5xl pt-12 lg:grid lg:grid-cols-[minmax(0,1fr)_220px] lg:gap-14")}>
        <article id="article-body" className="min-w-0">
          <div
            id="post-content"
            className="prose prose-zinc max-w-none dark:prose-invert prose-headings:font-serif prose-headings:tracking-tight prose-a:text-indigo-600 dark:prose-a:text-indigo-400 prose-pre:rounded-xl prose-pre:bg-zinc-900 prose-img:rounded-xl lg:prose-lg"
            dangerouslySetInnerHTML={{ __html: html }}
          />
          <CodeCopy containerId="post-content" />
          {post.tag_slugs.length > 0 && (
            <div className="mt-10 flex flex-wrap gap-2">
              {post.tag_slugs.map((tag) => (
                <Link key={tag.slug} href={`/tag/${tag.slug}/`} className="rounded-full border border-zinc-200 px-3 py-1 text-sm text-zinc-600 transition hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-white">
                  #{tag.name}
                </Link>
              ))}
            </div>
          )}
        </article>
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-10">
            <TableOfContents entries={toc} />
            <ShareLinks url={post.url} title={post.title} />
          </div>
        </aside>
      </div>

      {post.related.length > 0 && (
        <section className={cn(container, "max-w-5xl pt-20")} aria-labelledby="related-heading">
          <h2 id="related-heading" className="font-serif text-2xl font-semibold tracking-tight">Keep reading</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {post.related.slice(0, 3).map((related) => (
              <Link key={related.slug} href={`/post/${related.slug}/`} className="group overflow-hidden rounded-2xl border border-zinc-200 transition hover:-translate-y-1 hover:shadow-lg dark:border-zinc-800">
                <div className="aspect-[3/1]"><PostCover seed={related.slug} /></div>
                <p className="p-4 font-medium group-hover:text-indigo-600 dark:group-hover:text-indigo-300">{related.title}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className={cn(container, "max-w-3xl pt-20")}>
        <CommentSection slug={post.slug} initialComments={comments} user={user} />
      </div>
    </>
  );
}
