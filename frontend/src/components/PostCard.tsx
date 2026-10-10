import Link from "next/link";

import { formatDate, truncateWords } from "@/lib/format";
import type { PostSummary } from "@/lib/types";

export default function PostCard({ post }: { post: PostSummary }) {
  const href = `/post/${post.slug}/`;
  return (
    <article className="card post-card mb-4">
      {post.image && (
        // eslint-disable-next-line @next/next/no-img-element -- images are served by Django via the /media proxy
        <img src={post.image} className="card-img-top" alt={post.title} />
      )}
      <div className="card-body">
        <h2 className="card-title h4">
          <Link href={href}>{post.title}</Link>
        </h2>
        <p className="text-muted small mb-2">
          By {post.author} · {formatDate(post.published_at)}
          {post.category && post.category_slug && (
            <>
              {" · "}
              <Link href={`/category/${post.category_slug}/`}>{post.category}</Link>
            </>
          )}
        </p>
        <p>{truncateWords(post.summary, 30)}</p>
        <Link href={href} className="btn btn-outline-primary btn-sm">Read more</Link>
      </div>
    </article>
  );
}
