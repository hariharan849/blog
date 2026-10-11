import type { Metadata } from "next";
import { notFound } from "next/navigation";

import PageHeader from "@/components/PageHeader";
import { PostGrid } from "@/components/PostCard";
import { apiGet, apiGetOrNull } from "@/lib/server-api";
import type { Page, PostSummary } from "@/lib/types";
import { container } from "@/lib/ui";

type Props = PageProps<"/category/[slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const category = await apiGetOrNull<{ name: string }>(`/api/v1/categories/${encodeURIComponent((await params).slug)}/`);
  return { title: category ? `${category.name}` : "Topic not found" };
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const category = await apiGetOrNull<{ name: string; slug: string }>(`/api/v1/categories/${encodeURIComponent(slug)}/`);
  if (!category) notFound();
  const posts = await apiGet<Page<PostSummary>>(`/api/v1/posts/?category=${encodeURIComponent(slug)}&page_size=100`);
  return (
    <>
      <PageHeader eyebrow="Topic" title={category.name} description={`${posts.count} ${posts.count === 1 ? "post" : "posts"}`} />
      <div className={container}>
        <PostGrid posts={posts.results} empty="No posts in this topic yet." />
      </div>
    </>
  );
}
