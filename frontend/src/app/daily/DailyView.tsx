import Link from "next/link";
import type { FeedDay } from "@/lib/feed";
import type { PostMeta } from "@/lib/posts";
import { formatDay } from "@/lib/format";
import FeedItemCard from "@/components/FeedItemCard";
import LessonCard from "@/components/LessonCard";
import SubscribeForm from "@/components/SubscribeForm";

export default function DailyView({
  feed,
  recentDays,
  lesson,
  lessonCount = 0,
  feedNote,
}: {
  feed: FeedDay | null;
  recentDays: { day: string; count: number }[];
  /** The lesson to feature at the top (the latest one, or the one dated this day). */
  lesson?: PostMeta;
  lessonCount?: number;
  /** Shown instead of the feed when the feed backend isn't reachable. */
  feedNote?: string;
}) {
  return (
    <>
      <section className="hero">
        <p className="eyebrow">Daily Dose</p>
        <h1>{feed?.day ? formatDay(feed.day) : "The engineering world, one dose a day"}</h1>
        <p className="lead">
          A daily lesson written from a talk worth knowing, plus new posts from the GenAI writers I follow on Medium,
          Substack and the web.
        </p>
      </section>
    <div className="layout">
      <div>

        {lesson && (
          <section className="section section-first">
            <div className="section-head">
              <h2 className="section-title">Lesson of the day</h2>
              {lessonCount > 1 && <Link href="/daily/lessons">All {lessonCount} lessons →</Link>}
            </div>
            <LessonCard lesson={lesson} featured />
          </section>
        )}

        <section className="section">
          <div className="section-head">
            <h2 className="section-title">From the writers I follow</h2>
          </div>
          {!feed ? (
            <p className="muted empty">{feedNote}</p>
          ) : feed.items.length ? (
            <div className="stack">
              {feed.items.map((item) => (
                <FeedItemCard key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <p className="muted empty">No posts collected yet. The first batch arrives after the next 2 AM run.</p>
          )}

          {feed && (feed.prev_day || feed.next_day) && (
            <nav className="pagination" aria-label="Days">
              {feed.prev_day ? <Link href={`/daily/${feed.prev_day}`}>← {formatDay(feed.prev_day)}</Link> : <span />}
              {feed.next_day ? <Link href={`/daily/${feed.next_day}`}>{formatDay(feed.next_day)} →</Link> : <span />}
            </nav>
          )}
        </section>
      </div>

      <aside className="sidebar">
        <SubscribeForm />
        {recentDays.length > 0 && (
          <section className="card">
            <h3 className="card-header">Recent days</h3>
            <ul className="link-list">
              {recentDays.map((d) => (
                <li key={d.day} className={d.day === feed?.day ? "active" : undefined}>
                  <Link href={`/daily/${d.day}`}>{formatDay(d.day)}</Link>
                  <span className="count">{d.count}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </aside>
    </div>
    </>
  );
}
