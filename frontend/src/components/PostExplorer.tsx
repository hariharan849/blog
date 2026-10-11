"use client";

import { useMemo, useState } from "react";

import { FeaturedPostCard, PostGrid } from "./PostCard";

import { BLOGS } from "@/lib/format";
import type { BlogKey, Category, PostSummary } from "@/lib/types";
import { chip, chipActive, cn } from "@/lib/ui";

export type BlogFilter = BlogKey | "all";

const AUTHORS: { key: BlogFilter; label: string }[] = [
  { key: "all", label: "Everyone" },
  ...(Object.keys(BLOGS) as BlogKey[]).map((key) => ({ key, label: BLOGS[key].author.split(" ")[0] })),
];

/** Home page grid with instant author/topic filtering; the URL mirrors the filters for sharing. */
export default function PostExplorer({ posts, categories, initialBlog, initialTopic }: {
  posts: PostSummary[];
  categories: Category[];
  initialBlog: BlogFilter;
  initialTopic: string;
}) {
  const [blog, setBlog] = useState<BlogFilter>(initialBlog);
  const [topic, setTopic] = useState(initialTopic);

  function update(nextBlog: BlogFilter, nextTopic: string) {
    setBlog(nextBlog);
    setTopic(nextTopic);
    const params = new URLSearchParams();
    if (nextBlog !== "all") params.set("blog", nextBlog);
    if (nextTopic) params.set("topic", nextTopic);
    const query = params.toString();
    window.history.replaceState(null, "", query ? `/?${query}` : "/");
  }

  const byAuthor = useMemo(() => (blog === "all" ? posts : posts.filter((post) => post.blog === blog)), [posts, blog]);
  const filtered = useMemo(() => (topic ? byAuthor.filter((post) => post.category_slug === topic) : byAuthor), [byAuthor, topic]);
  const topicCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const post of byAuthor) if (post.category_slug) counts.set(post.category_slug, (counts.get(post.category_slug) ?? 0) + 1);
    return counts;
  }, [byAuthor]);

  const unfiltered = blog === "all" && !topic;
  const [featured, ...rest] = filtered;

  return (
    <section aria-label="Posts" className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div role="group" aria-label="Filter by topic" className="flex flex-wrap gap-2">
          <button type="button" className={topic ? chip : chipActive} aria-pressed={!topic} onClick={() => update(blog, "")}>
            All topics
          </button>
          {categories.map((category) => {
            const count = topicCounts.get(category.slug) ?? 0;
            const selected = topic === category.slug;
            return (
              <button
                key={category.slug}
                type="button"
                aria-pressed={selected}
                disabled={!count && !selected}
                onClick={() => update(blog, selected ? "" : category.slug)}
                className={cn(selected ? chipActive : chip, "disabled:opacity-40")}
              >
                {category.name}
                <span className={cn("text-xs", selected ? "opacity-70" : "text-zinc-500 dark:text-zinc-400")}>{count}</span>
              </button>
            );
          })}
        </div>
        <div role="group" aria-label="Filter by author" className="flex w-fit rounded-full border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-900">
          {AUTHORS.map((author) => (
            <button
              key={author.key}
              type="button"
              aria-pressed={blog === author.key}
              onClick={() => update(author.key, topic)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-sm transition",
                blog === author.key
                  ? "bg-white font-medium text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-white"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white",
              )}
            >
              {author.label}
            </button>
          ))}
        </div>
      </div>

      <p className="sr-only" aria-live="polite">{filtered.length} posts shown</p>

      {unfiltered && featured ? (
        <>
          <FeaturedPostCard key={`featured-${featured.slug}`} post={featured} />
          {rest.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500">Latest</h2>
              <PostGrid posts={rest} />
            </div>
          )}
        </>
      ) : (
        <PostGrid key={`${blog}-${topic}`} posts={filtered} empty="No posts match these filters yet." />
      )}
    </section>
  );
}
