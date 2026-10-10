import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import CommentSection from "@/components/CommentSection";
import { formatDate, jsonLd } from "@/lib/format";
import { apiGet, apiGetOrNull, getCurrentUser } from "@/lib/server-api";
import type { Comment, PostDetail } from "@/lib/types";

async function getPost(slug: string) {
  return apiGetOrNull<PostDetail>(`/api/v1/posts/${encodeURIComponent(slug)}/`);
}

export async function generateMetadata({ params }: PageProps<"/post/[slug]">): Promise<Metadata> {
  const post = await getPost((await params).slug);
  if (!post) return { title: "Post not found" };
  return {
    title: post.title,
    description: post.summary.slice(0, 160),
    alternates: { canonical: post.url },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.summary.slice(0, 200),
      url: post.url,
      publishedTime: post.published_at,
      images: post.image ? [post.image] : undefined,
    },
  };
}

export default async function PostPage({ params }: PageProps<"/post/[slug]">) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();
  const [comments, user] = await Promise.all([
    apiGet<Comment[]>(`/api/v1/posts/${encodeURIComponent(slug)}/comments/`),
    getCurrentUser(),
  ]);
  const shareUrl = encodeURIComponent(post.url);

  return (
    <div className="row">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(post.structured_data) }} />
      <article className="col-lg-8">
        <div className="card">
          {post.image && (
            // eslint-disable-next-line @next/next/no-img-element -- served by Django via the /media proxy
            <img src={post.image} className="card-img-top" alt={post.title} />
          )}
          <div className="card-body">
            <h1 className="card-title">{post.title}</h1>
            <p className="text-muted">
              By <strong>{post.author}</strong> · {formatDate(post.published_at)}
            </p>
            {post.category && post.category_slug && (
              <p>
                <strong>Category: </strong>
                <Link href={`/category/${post.category_slug}/`} className="badge bg-primary text-decoration-none">
                  {post.category}
                </Link>
              </p>
            )}
            {post.tag_slugs.length > 0 && (
              <p>
                <strong>Tags: </strong>
                {post.tag_slugs.map((tag) => (
                  <Link key={tag.slug} href={`/tag/${tag.slug}/`} className="badge bg-secondary text-decoration-none me-1">
                    {tag.name}
                  </Link>
                ))}
              </p>
            )}
            <hr />
            {/* Sanitised server-side (nh3) when the post is saved. */}
            <div className="post-content" dangerouslySetInnerHTML={{ __html: post.content_html }} />
            <hr />
            <div className="d-flex gap-2 align-items-center">
              <strong>Share:</strong>
              <a className="btn btn-sm btn-info" target="_blank" rel="noopener noreferrer"
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${shareUrl}`}>Twitter</a>
              <a className="btn btn-sm btn-primary" target="_blank" rel="noopener noreferrer"
                href={`https://www.linkedin.com/shareArticle?mini=true&url=${shareUrl}`}>LinkedIn</a>
              <a className="btn btn-sm btn-success" target="_blank" rel="noopener noreferrer"
                href={`https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`}>Facebook</a>
            </div>
          </div>
        </div>
        <CommentSection slug={post.slug} initialComments={comments} user={user} />
      </article>
      <aside className="col-lg-4 sidebar mt-4 mt-lg-0">
        <div className="card">
          <div className="card-header">Related Posts</div>
          <ul className="list-group list-group-flush">
            {post.related.length ? (
              post.related.map((related) => (
                <li className="list-group-item" key={related.slug}>
                  <Link href={`/post/${related.slug}/`}>{related.title}</Link>
                </li>
              ))
            ) : (
              <li className="list-group-item text-muted">No related posts found.</li>
            )}
          </ul>
        </div>
      </aside>
    </div>
  );
}
