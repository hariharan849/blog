import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api, safe } from "@/lib/api";
import PostList from "@/components/PostList";
import Pagination from "@/components/Pagination";
import Sidebar from "@/components/Sidebar";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> };

async function findCategory(slug: string) {
  const categories = await safe(api.categories(), []);
  return categories.find((c) => c.slug === slug);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const category = await findCategory((await params).slug);
  return { title: category ? `Posts in ${category.name}` : "Category" };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const category = await findCategory(slug);
  if (!category) notFound();
  const data = await safe(api.posts({ category: slug, page }), null);

  return (
    <div className="layout">
      <div>
        <section className="hero">
          <p className="eyebrow">Category</p>
          <h1>{category.name}</h1>
        </section>
        <PostList posts={data?.results ?? []} empty="No posts in this category yet." />
        {data && <Pagination page={data.page} numPages={data.num_pages} basePath={`/category/${slug}`} />}
      </div>
      <Sidebar />
    </div>
  );
}
