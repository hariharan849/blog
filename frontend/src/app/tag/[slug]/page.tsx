import type { Metadata } from "next";
import { notFound } from "next/navigation";

import PostList from "@/components/PostList";
import { apiGet, apiGetOrNull } from "@/lib/server-api";
import type { Page, PostSummary } from "@/lib/types";

type Props = PageProps<"/tag/[slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const tag = await apiGetOrNull<{ name: string }>(`/api/v1/tags/${encodeURIComponent((await params).slug)}/`);
  return { title: tag ? `#${tag.name}` : "Tag not found" };
}

export default async function TagPage({ params }: Props) {
  const { slug } = await params;
  const tag = await apiGetOrNull<{ name: string; slug: string }>(`/api/v1/tags/${encodeURIComponent(slug)}/`);
  if (!tag) notFound();
  const posts = await apiGet<Page<PostSummary>>(`/api/v1/posts/?tag=${encodeURIComponent(slug)}`);
  return (
    <>
      <h1 className="h3 mb-4">#{tag.name}</h1>
      <PostList posts={posts.results} empty="No posts with this tag." />
    </>
  );
}
