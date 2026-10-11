import PostExplorer, { type BlogFilter } from "@/components/PostExplorer";
import SearchButton from "@/components/SearchButton";
import { apiGet } from "@/lib/server-api";
import type { Category, Page, PostSummary } from "@/lib/types";
import { cn, container } from "@/lib/ui";

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const { blog, topic } = await searchParams;
  const initialBlog: BlogFilter = blog === "hariharan" || blog === "rajan" ? blog : "all";
  const [posts, categories] = await Promise.all([
    apiGet<Page<PostSummary>>("/api/v1/posts/?page_size=100"),
    apiGet<Category[]>("/api/v1/categories/"),
  ]);

  return (
    <div className="relative">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(60%_60%_at_50%_0%,rgb(99_102_241/0.14),transparent)] dark:bg-[radial-gradient(60%_60%_at_50%_0%,rgb(99_102_241/0.22),transparent)]" />
      <div className={cn(container, "pb-8 pt-16 sm:pt-24")}>
        <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">PyChanter · notes on AI &amp; engineering</p>
        <h1 className="mt-3 max-w-3xl font-serif text-4xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">
          Ideas on deep learning, machine learning and building with AI.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
          Practical write-ups by Hariharan Manoharan and Rajan Singh. Search by meaning, not just keywords.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <SearchButton wide />
          <p className="text-sm text-zinc-500">
            {posts.count} posts · {categories.length} topics
          </p>
        </div>
      </div>
      <div className={cn(container, "pt-6")}>
        <PostExplorer
          posts={posts.results}
          categories={categories}
          initialBlog={initialBlog}
          initialTopic={typeof topic === "string" ? topic : ""}
        />
      </div>
    </div>
  );
}
