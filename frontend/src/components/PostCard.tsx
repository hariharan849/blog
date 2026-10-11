import Link from "next/link";

import PostCover from "./PostCover";

import { formatDate, truncateWords } from "@/lib/format";
import type { PostSummary } from "@/lib/types";
import { cn } from "@/lib/ui";

function Meta({ post }: { post: PostSummary }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 text-xs text-zinc-500 dark:text-zinc-400">
      <span>{post.author}</span>
      <span aria-hidden>·</span>
      <time dateTime={post.published_at}>{formatDate(post.published_at)}</time>
      <span aria-hidden>·</span>
      <span>{post.reading_minutes} min read</span>
    </p>
  );
}

export function FeaturedPostCard({ post }: { post: PostSummary }) {
  return (
    <article className="group relative grid animate-fade-in overflow-hidden rounded-3xl border border-zinc-200/80 bg-white shadow-sm transition hover:shadow-xl hover:shadow-zinc-900/5 md:grid-cols-[1.2fr_1fr] dark:border-zinc-800 dark:bg-zinc-900/60">
      <div className="aspect-[16/9] md:aspect-auto md:min-h-80">
        <PostCover seed={post.slug} image={post.image} label={post.category} large className="transition duration-500 group-hover:scale-[1.02]" />
      </div>
      <div className="flex flex-col justify-center gap-4 p-6 sm:p-8">
        <span className="w-fit rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-300">Featured</span>
        <h2 className="font-serif text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
          <Link href={`/post/${post.slug}/`} className="after:absolute after:inset-0">
            {post.title}
          </Link>
        </h2>
        <p className="text-zinc-600 dark:text-zinc-400">{truncateWords(post.summary, 40)}</p>
        <Meta post={post} />
      </div>
    </article>
  );
}

export default function PostCard({ post, className }: { post: PostSummary; className?: string }) {
  return (
    <article
      className={cn(
        "group relative flex animate-fade-in flex-col overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm transition duration-300",
        "hover:-translate-y-1 hover:shadow-xl hover:shadow-zinc-900/5 dark:border-zinc-800 dark:bg-zinc-900/60",
        className,
      )}
    >
      <div className="aspect-[16/9] overflow-hidden">
        <PostCover seed={post.slug} image={post.image} label={post.category} className="transition duration-500 group-hover:scale-105" />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <h3 className="font-serif text-xl font-semibold leading-snug tracking-tight">
          <Link href={`/post/${post.slug}/`} className="after:absolute after:inset-0 group-hover:text-indigo-600 dark:group-hover:text-indigo-300">
            {post.title}
          </Link>
        </h3>
        <p className="line-clamp-3 flex-1 text-sm text-zinc-600 dark:text-zinc-400">{post.summary}</p>
        <Meta post={post} />
      </div>
    </article>
  );
}

export function PostGrid({ posts, empty = "No posts yet." }: { posts: PostSummary[]; empty?: string }) {
  if (!posts.length) {
    return <p className="rounded-2xl border border-dashed border-zinc-300 p-10 text-center text-zinc-500 dark:border-zinc-700">{empty}</p>;
  }
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {posts.map((post) => <PostCard key={post.slug} post={post} />)}
    </div>
  );
}
