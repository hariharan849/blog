import type { Metadata } from "next";
import { notFound } from "next/navigation";

import PostList from "@/components/PostList";
import { apiGet, apiGetOrNull } from "@/lib/server-api";
import type { Page, PostSummary } from "@/lib/types";

type Props = PageProps<"/category/[slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const category = await apiGetOrNull<{ name: string }>(`/api/v1/categories/${encodeURIComponent((await params).slug)}/`);
  return { title: category ? `${category.name} posts` : "Category not found" };
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const category = await apiGetOrNull<{ name: string; slug: string }>(`/api/v1/categories/${encodeURIComponent(slug)}/`);
  if (!category) notFound();
  const posts = await apiGet<Page<PostSummary>>(`/api/v1/posts/?category=${encodeURIComponent(slug)}`);
  return (
    <>
      <h1 className="h3 mb-4">{category.name} posts</h1>
      <PostList posts={posts.results} empty="No posts found in this category." />
    </>
  );
}
