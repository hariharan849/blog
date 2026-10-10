import Link from "next/link";

import PostList from "@/components/PostList";
import Sidebar from "@/components/Sidebar";
import { BLOGS } from "@/lib/format";
import { apiGet } from "@/lib/server-api";
import type { BlogKey, Category, Page, PostSummary } from "@/lib/types";

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const { blog: requested } = await searchParams;
  const blog: BlogKey = requested === "rajan" ? "rajan" : "hariharan";
  const [posts, categories] = await Promise.all([
    apiGet<Page<PostSummary>>(`/api/v1/posts/?blog=${blog}`),
    apiGet<Category[]>("/api/v1/categories/"),
  ]);

  return (
    <div className="row">
      <div className="col-lg-8">
        <ul className="nav nav-pills mb-4">
          {(Object.keys(BLOGS) as BlogKey[]).map((key) => (
            <li className="nav-item" key={key}>
              <Link className={`nav-link${key === blog ? " active" : ""}`} href={key === "hariharan" ? "/" : `/?blog=${key}`}>
                {BLOGS[key].label}
              </Link>
            </li>
          ))}
        </ul>
        <h1 className="h3 mb-3 text-primary">My Thoughts and Posts</h1>
        <PostList posts={posts.results} />
      </div>
      <div className="col-lg-4">
        <Sidebar blog={blog} recent={posts.results.slice(0, 5)} categories={categories} />
      </div>
    </div>
  );
}
