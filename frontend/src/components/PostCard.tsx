import Link from "next/link";
import type { PostSummary } from "@/lib/api";
import { formatDate } from "@/lib/format";

export default function PostCard({ post }: { post: PostSummary }) {
  return (
    <article className="card post-card">
      {post.image && (
        // eslint-disable-next-line @next/next/no-img-element -- images are served by Django media
        <img src={post.image} alt="" className="post-card-image" loading="lazy" />
      )}
      <div className="card-body">
        <div className="meta">
          {post.category && (
            <Link href={`/category/${post.category.slug}`} className="badge">
              {post.category.name}
            </Link>
          )}
          <time dateTime={post.created_at}>{formatDate(post.created_at)}</time>
        </div>
        <h2 className="post-card-title">
          <Link href={`/posts/${post.slug}`}>{post.title}</Link>
        </h2>
        <p className="excerpt">{post.excerpt}</p>
        <Link href={`/posts/${post.slug}`} className="read-more">
          Read more →
        </Link>
      </div>
    </article>
  );
}
