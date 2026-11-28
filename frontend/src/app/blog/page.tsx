import type { Metadata } from "next";
import Link from "next/link";
import { getPosts, getTags } from "@/lib/posts";
import PostCard from "@/components/PostCard";
import Pagination from "@/components/Pagination";
import { paginate } from "@/lib/paginate";

const PER_PAGE = 10;

export const metadata: Metadata = { title: "Blog" };

type Props = { searchParams: Promise<{ page?: string }> };

export default async function BlogPage({ searchParams }: Props) {
  const { items: posts, pager } = paginate(getPosts(), (await searchParams).page, PER_PAGE);
  const tags = getTags();
  return (
    <>
      <section className="hero">
        <h1>Blog</h1>
        <p className="lead">Notes on GenAI, agents and ML engineering.</p>
        {tags.length > 0 && (
          <p className="tag-row">
            {tags.map(({ tag, count }) => (
              <Link key={tag} href={`/blog/tag/${tag}`} className="badge badge-muted">
                #{tag} <span className="count">{count}</span>
              </Link>
            ))}
          </p>
        )}
      </section>
      {pager.total ? (
        <div className="stack">
          {posts.map((p) => (
            <PostCard key={p.slug} post={p} />
          ))}
        </div>
      ) : (
        <p className="muted empty">No posts yet.</p>
      )}
      <Pagination base="/blog" noun="posts" {...pager} />
    </>
  );
}
