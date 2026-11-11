import Link from "next/link";
import { api, safe } from "@/lib/api";
import SearchForm from "./SearchForm";

export default async function Sidebar() {
  const [recent, categories, tags] = await Promise.all([
    safe(api.recent(5), []),
    safe(api.categories(), []),
    safe(api.tags(), []),
  ]);

  return (
    <aside className="sidebar">
      <section className="card">
        <div className="card-body">
          <SearchForm />
        </div>
      </section>

      <section className="card">
        <h3 className="card-header">Recent Posts</h3>
        <ul className="link-list">
          {recent.length ? (
            recent.map((p) => (
              <li key={p.slug}>
                <Link href={`/posts/${p.slug}`}>{p.title}</Link>
              </li>
            ))
          ) : (
            <li className="muted">No recent posts</li>
          )}
        </ul>
      </section>

      <section className="card">
        <h3 className="card-header">Categories</h3>
        <ul className="link-list">
          {categories.length ? (
            categories.map((c) => (
              <li key={c.slug}>
                <Link href={`/category/${c.slug}`}>{c.name}</Link>
                {typeof c.post_count === "number" && <span className="count">{c.post_count}</span>}
              </li>
            ))
          ) : (
            <li className="muted">No categories available</li>
          )}
        </ul>
      </section>

      {tags.length > 0 && (
        <section className="card">
          <h3 className="card-header">Tags</h3>
          <div className="card-body tag-cloud">
            {tags.map((t) => (
              <Link key={t.slug} href={`/tag/${t.slug}`} className="badge badge-muted">
                #{t.name}
              </Link>
            ))}
          </div>
        </section>
      )}
    </aside>
  );
}
