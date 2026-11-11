import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { api, ApiError } from "@/lib/api";
import { formatDate, readingTime, SITE_URL } from "@/lib/format";
import CommentForm from "@/components/CommentForm";
import ShareLinks from "@/components/ShareLinks";

type Props = { params: Promise<{ slug: string }> };

const getPost = cache(async (slug: string) => {
  try {
    return await api.post(slug);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  return {
    title: post.title,
    description: post.excerpt,
    openGraph: { title: post.title, description: post.excerpt, images: post.image ? [post.image] : [] },
  };
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPost(slug);
  const url = `${SITE_URL}/posts/${post.slug}`;

  return (
    <div className="layout">
      <div>
        <article className="card">
          {post.image && (
            // eslint-disable-next-line @next/next/no-img-element -- images are served by Django media
            <img src={post.image} alt="" className="post-hero-image" />
          )}
          <div className="card-body">
            <h1 className="post-title">{post.title}</h1>
            <p className="meta">
              By <Link href={`/?author=${post.author.username}`}>{post.author.name}</Link> ·{" "}
              <time dateTime={post.created_at}>{formatDate(post.created_at)}</time> ·{" "}
              {readingTime(post.content)} min read
            </p>
            {(post.category || post.tags.length > 0) && (
              <p className="meta">
                {post.category && (
                  <Link href={`/category/${post.category.slug}`} className="badge">
                    {post.category.name}
                  </Link>
                )}
                {post.tags.map((t) => (
                  <Link key={t.slug} href={`/tag/${t.slug}`} className="badge badge-muted">
                    #{t.name}
                  </Link>
                ))}
              </p>
            )}
            <hr />
            {/* Content is authored by site admins via CKEditor in the Django admin. */}
            <div className="prose" dangerouslySetInnerHTML={{ __html: post.content }} />
            <hr />
            <ShareLinks title={post.title} url={url} />
            <p>
              <Link href="/" className="button button-secondary">
                ← Back to Home
              </Link>
            </p>
          </div>
        </article>

        <section className="comments" aria-labelledby="comments-heading">
          <h2 id="comments-heading">Comments ({post.comments.length})</h2>
          {post.comments.length ? (
            <ul className="comment-list">
              {post.comments.map((c) => (
                <li key={c.id} className="card">
                  <div className="card-body">
                    <p className="meta">
                      <strong>{c.name}</strong> · {formatDate(c.created_at, true)}
                    </p>
                    <p className="comment-body">{c.content}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No comments yet. Be the first to comment!</p>
          )}
          <CommentForm slug={post.slug} />
        </section>
      </div>

      <aside className="sidebar">
        <section className="card">
          <h3 className="card-header">Related Posts</h3>
          <ul className="link-list">
            {post.related.length ? (
              post.related.map((r) => (
                <li key={r.slug}>
                  <Link href={`/posts/${r.slug}`}>{r.title}</Link>
                </li>
              ))
            ) : (
              <li className="muted">No related posts found.</li>
            )}
          </ul>
        </section>
      </aside>
    </div>
  );
}
