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
  lessonAuthors = [],
}: {
  feed: FeedDay | null;
  recentDays: { day: string; count: number }[];
  /** The lesson to feature at the top (the latest one, or the one dated this day). */
  lesson?: PostMeta;
  lessonCount?: number;
  /** Shown instead of the feed when the feed backend isn't reachable. */
  feedNote?: string;
  /** Source authors of the lessons, for the "Browse lessons" sidebar card. */
  lessonAuthors?: { author: string; slug: string; count: number }[];
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
        {lessonCount > 0 && (
          <section className="card">
            <h3 className="card-header">Browse lessons</h3>
            <ul className="link-list">
              <li>
                <Link href="/daily/lessons">Latest</Link>
                <span className="count">{lessonCount}</span>
              </li>
              <li>
                <Link href="/daily/lessons?view=title">By title (A–Z)</Link>
              </li>
              <li>
                <Link href="/daily/lessons?view=author">By author</Link>
              </li>
            </ul>
            {lessonAuthors.length > 0 && (
              <div className="card-body sidebar-authors">
                <p className="kicker">Authors</p>
                <div className="tag-row">
                  {lessonAuthors.map((a) => (
                    <Link key={a.slug} href={`/daily/lessons?view=author&author=${a.slug}`} className="chip">
                      {a.author} <span className="chip-count">{a.count}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
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
