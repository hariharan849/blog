import type { Metadata } from "next";
import Link from "next/link";
import { getPosts, getTags } from "@/lib/posts";
import PostCard from "@/components/PostCard";

export const metadata: Metadata = { title: "Blog" };

export default function BlogPage() {
  const posts = getPosts();
  const tags = getTags();
  return (
    <>
      <section className="hero">
        <h1>Blog</h1>
        <p className="lead">Notes on GenAI, ML engineering and VFX tooling.</p>
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
      {posts.length ? (
        <div className="stack">
          {posts.map((p) => (
            <PostCard key={p.slug} post={p} />
          ))}
        </div>
      ) : (
        <p className="muted empty">No posts yet.</p>
      )}
    </>
  );
}
