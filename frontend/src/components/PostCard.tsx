import Link from "next/link";
import type { PostMeta } from "@/lib/posts";
import { formatDate } from "@/lib/format";

export default function PostCard({ post }: { post: PostMeta }) {
  return (
    <article className="card post-card">
      <div className="card-body">
        <p className="meta">
          <time dateTime={post.date}>{formatDate(post.date)}</time> · {post.readingMinutes} min read
          {post.draft && <span className="badge badge-warn">Draft</span>}
        </p>
        <h3 className="post-card-title">
          <Link href={`/blog/${post.slug}`}>{post.title}</Link>
        </h3>
        {post.summary && <p className="excerpt">{post.summary}</p>}
        {post.tags.length > 0 && (
          <p className="tag-row">
            {post.tags.map((t) => (
              <Link key={t} href={`/blog/tag/${t}`} className="badge badge-muted">
                #{t}
              </Link>
            ))}
          </p>
        )}
      </div>
    </article>
  );
}
