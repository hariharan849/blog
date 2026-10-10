import Link from "next/link";

import { BLOGS } from "@/lib/format";
import type { BlogKey, Category, PostSummary } from "@/lib/types";

export default function Sidebar({ blog, recent, categories }: { blog: BlogKey; recent: PostSummary[]; categories: Category[] }) {
  const info = BLOGS[blog];
  return (
    <aside className="sidebar">
      <div className="card mb-4">
        <div className="card-body">
          <form action="/search/" method="get">
            <div className="input-group">
              <input type="search" name="q" className="form-control" placeholder="Search posts..." aria-label="Search posts" />
              <button className="btn btn-primary" type="submit">Search</button>
            </div>
          </form>
        </div>
      </div>
      <div className="card mb-4">
        <div className="card-header">About</div>
        <div className="card-body">
          <p className="mb-2">{info.author}</p>
          <Link href={`/about/${blog}/`}>Read more about me</Link>
        </div>
      </div>
      <div className="card mb-4">
        <div className="card-header">Recent Posts</div>
        <ul className="list-group list-group-flush">
          {recent.length ? (
            recent.map((post) => (
              <li className="list-group-item" key={post.slug}>
                <Link href={`/post/${post.slug}/`}>{post.title}</Link>
              </li>
            ))
          ) : (
            <li className="list-group-item text-muted">No recent posts</li>
          )}
        </ul>
      </div>
      <div className="card">
        <div className="card-header">Categories</div>
        <ul className="list-group list-group-flush">
          {categories.length ? (
            categories.map((category) => (
              <li className="list-group-item d-flex justify-content-between" key={category.slug}>
                <Link href={`/category/${category.slug}/`}>{category.name}</Link>
                <span className="badge bg-secondary">{category.post_count}</span>
              </li>
            ))
          ) : (
            <li className="list-group-item text-muted">No categories yet</li>
          )}
        </ul>
      </div>
    </aside>
  );
}
