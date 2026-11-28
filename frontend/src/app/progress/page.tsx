import type { Metadata } from "next";
import Link from "next/link";
import { getProgressUpdates } from "@/lib/posts";
import { formatDate } from "@/lib/format";
import Pagination from "@/components/Pagination";
import { paginate } from "@/lib/paginate";

export const metadata: Metadata = {
  title: "Weekly progress",
  description: "A short note each week on what I built, learned and published.",
};

const PER_PAGE = 5;
type Props = { searchParams: Promise<{ page?: string }> };

export default async function ProgressPage({ searchParams }: Props) {
  const { items, pager } = paginate(getProgressUpdates(), (await searchParams).page, PER_PAGE);
  return (
    <>
      <section className="hero">
        <p className="eyebrow">Weekly progress</p>
        <h1>What I did this week</h1>
        <p className="lead">
          A short note every week on what I finished, published and learned, measured against my{" "}
          <Link href="/roadmap">roadmap</Link>.
        </p>
      </section>
      {items.length ? (
        <div className="narrow progress-list">
          {items.map((u) => (
            <article key={u.slug} id={u.slug} className="card progress-entry">
              <div className="card-body">
                <p className="meta">
                  <time dateTime={u.date}>{formatDate(u.date, { month: "long" })}</time>
                </p>
                <h2 className="tile-title">{u.title}</h2>
                {/* Updates are Markdown files committed to this repo from /admin by the site owner. */}
                <div className="prose" dangerouslySetInnerHTML={{ __html: u.html }} />
              </div>
            </article>
          ))}
          <Pagination base="/progress" noun="updates" {...pager} />
        </div>
      ) : (
        <p className="muted empty">The first weekly update is coming soon.</p>
      )}
    </>
  );
}
