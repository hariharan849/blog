import Link from "next/link";
import type { FeedDay } from "@/lib/feed";
import { formatDay } from "@/lib/format";
import FeedItemCard from "@/components/FeedItemCard";

export default function DailyView({
  feed,
  recentDays,
}: {
  feed: FeedDay;
  recentDays: { day: string; count: number }[];
}) {
  return (
    <div className="layout">
      <div>
        <section className="hero">
          <p className="eyebrow">Daily Dose</p>
          <h1>{feed.day ? formatDay(feed.day) : "Nothing yet"}</h1>
          <p className="lead">
            New posts from the GenAI writers I follow on Medium, Substack and the web, collected every morning.
          </p>
        </section>

        {feed.items.length ? (
          <div className="stack">
            {feed.items.map((item) => (
              <FeedItemCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <p className="muted empty">No posts collected yet. The first batch arrives after the next 2 AM run.</p>
        )}

        {(feed.prev_day || feed.next_day) && (
          <nav className="pagination" aria-label="Days">
            {feed.prev_day ? <Link href={`/daily/${feed.prev_day}`}>← {formatDay(feed.prev_day)}</Link> : <span />}
            {feed.next_day ? <Link href={`/daily/${feed.next_day}`}>{formatDay(feed.next_day)} →</Link> : <span />}
          </nav>
        )}
      </div>

      {recentDays.length > 0 && (
        <aside className="sidebar">
          <section className="card">
            <h3 className="card-header">Recent days</h3>
            <ul className="link-list">
              {recentDays.map((d) => (
                <li key={d.day} className={d.day === feed.day ? "active" : undefined}>
                  <Link href={`/daily/${d.day}`}>{formatDay(d.day)}</Link>
                  <span className="count">{d.count}</span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      )}
    </div>
  );
}
