import type { Metadata } from "next";
import { notFound } from "next/navigation";

import PageHeader from "@/components/PageHeader";
import { PostGrid } from "@/components/PostCard";
import { apiGet, apiGetOrNull } from "@/lib/server-api";
import type { Page, PostSummary } from "@/lib/types";
import { container } from "@/lib/ui";

type Props = PageProps<"/tag/[slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const tag = await apiGetOrNull<{ name: string }>(`/api/v1/tags/${encodeURIComponent((await params).slug)}/`);
  return { title: tag ? `#${tag.name}` : "Tag not found" };
}

export default async function TagPage({ params }: Props) {
  const { slug } = await params;
  const tag = await apiGetOrNull<{ name: string; slug: string }>(`/api/v1/tags/${encodeURIComponent(slug)}/`);
  if (!tag) notFound();
  const posts = await apiGet<Page<PostSummary>>(`/api/v1/posts/?tag=${encodeURIComponent(slug)}&page_size=100`);
  return (
    <>
      <PageHeader eyebrow="Tag" title={`#${tag.name}`} description={`${posts.count} ${posts.count === 1 ? "post" : "posts"}`} />
      <div className={container}>
        <PostGrid posts={posts.results} empty="No posts with this tag." />
      </div>
    </>
  );
}
