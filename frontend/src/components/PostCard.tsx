import Link from "next/link";
import type { PostMeta } from "@/lib/posts";
import { formatDate } from "@/lib/format";

export default function PostCard({ post }: { post: PostMeta }) {
  const href = `/blog/${post.slug}`;
  return (
    <article className="card tile">
      <div className="card-body tile-body">
        <p className="meta">
          <time dateTime={post.date}>{formatDate(post.date)}</time> · {post.readingMinutes} min read
          {post.draft && <span className="badge badge-warn">Draft</span>}
        </p>
        <h3 className="tile-title">
          <Link href={href}>{post.title}</Link>
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
        <Link href={href} className="read-more">
          Read more <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  );
}
