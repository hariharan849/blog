import type { Metadata } from "next";
import Link from "next/link";
import { authorSlug, getLessonAuthors, getLessons, type PostMeta } from "@/lib/posts";
import { formatDate } from "@/lib/format";
import LessonCard from "@/components/LessonCard";
import SubscribeForm from "@/components/SubscribeForm";
import Pagination from "@/components/Pagination";
import { paginate } from "@/lib/paginate";

/** Cards on the Latest view; the compact A–Z and by-author indexes fit more per page. */
const PER_PAGE = { latest: 10, title: 30, author: 30 } as const;

export const metadata: Metadata = {
  title: "Daily lessons",
  description:
    "One engineering lesson a day, written from a talk or article worth knowing. Browse by title or by author.",
};

type View = "latest" | "title" | "author";
type Props = { searchParams: Promise<{ view?: string; author?: string; page?: string }> };

const VIEWS: { id: View; label: string }[] = [
  { id: "latest", label: "Latest" },
  { id: "title", label: "By title (A–Z)" },
  { id: "author", label: "By author" },
];

const authorOf = (l: PostMeta) => l.sourceAuthor ?? "Other sources";

function firstLetter(title: string) {
  const c = title.trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(c) ? c : "#";
}

function group<T>(items: T[], key: (t: T) => string) {
  const map = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    map.set(k, [...(map.get(k) ?? []), it]);
  }
  return [...map];
}

function TitleRow({ lesson }: { lesson: PostMeta }) {
  return (
    <li>
      <Link href={`/daily/lessons/${lesson.slug}`} className="entry-title">
        {lesson.title}
      </Link>
      <p className="entry-meta">
        {lesson.sourceAuthor && <>{lesson.sourceAuthor} · </>}
        <time dateTime={lesson.date}>{formatDate(lesson.date)}</time> · {lesson.readingMinutes} min read
      </p>
      {lesson.summary && <p className="entry-excerpt">{lesson.summary}</p>}
    </li>
  );
}

export default async function LessonsPage({ searchParams }: Props) {
  const params = await searchParams;
  const all = getLessons();
  const authors = getLessonAuthors();
  const author = authors.find((a) => a.slug === params.author);
  const filtered = author ? all.filter((l) => authorSlug(authorOf(l)) === author.slug) : all;
  const view: View = VIEWS.some((v) => v.id === params.view) ? (params.view as View) : "latest";
  const ordered =
    view === "title"
      ? [...filtered].sort((a, b) => a.title.localeCompare(b.title))
      : view === "author"
        ? [...filtered].sort((a, b) => authorOf(a).localeCompare(authorOf(b)) || b.date.localeCompare(a.date))
        : filtered;
  const { items: lessons, pager } = paginate(ordered, params.page, PER_PAGE[view]);
  /** Total lessons by an author, not just the ones on this page. */
  const lessonCount = (name: string, onPage: number) => {
    const n = authors.find((a) => a.author === name)?.count ?? onPage;
    return `${n} lesson${n === 1 ? "" : "s"}`;
  };
  const href = (v: View, a = author?.slug) => {
    const q = new URLSearchParams();
    if (v !== "latest") q.set("view", v);
    if (a) q.set("author", a);
    const s = q.toString();
    return `/daily/lessons${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <section className="hero">
        <p className="eyebrow">
          <Link href="/daily">Daily Dose</Link>
        </p>
        <h1>{author ? `Lessons from ${author.author}` : "Daily lessons"}</h1>
        <p className="lead">
          One engineering lesson a day, written from a talk or article on my reading list, so it takes a few minutes to
          read instead of an hour to watch.
        </p>
      </section>

      <div className="layout">
        <div>
          <nav className="view-tabs" aria-label="Sort lessons">
            {VIEWS.map((v) => (
              <Link
                key={v.id}
                href={href(v.id)}
                className={v.id === view ? "active" : undefined}
                aria-current={v.id === view ? "page" : undefined}
              >
                {v.label}
              </Link>
            ))}
          </nav>

          {authors.length > 0 && (
            <div className="filter-row" aria-label="Filter by author">
              <span className="filter-label">Author</span>
              <Link href={href(view, "")} className={`chip${author ? "" : " chip-active"}`}>
                All <span className="chip-count">{all.length}</span>
              </Link>
              {authors.map((a) => (
                <Link
                  key={a.slug}
                  href={href(view, a.slug)}
                  className={`chip${author?.slug === a.slug ? " chip-active" : ""}`}
                >
                  {a.author} <span className="chip-count">{a.count}</span>
                </Link>
              ))}
            </div>
          )}

          {!lessons.length ? (
            <p className="muted empty">No lessons yet. The first one arrives with the next daily run.</p>
          ) : view === "title" ? (
            group(lessons, (l) => firstLetter(l.title)).map(([letter, list]) => (
              <section key={letter} className="index-group">
                <h2 className="index-letter">{letter}</h2>
                <ul className="entry-list card index-card">
                  {list.map((l) => (
                    <TitleRow key={l.slug} lesson={l} />
                  ))}
                </ul>
              </section>
            ))
          ) : view === "author" ? (
            group(lessons, authorOf).map(([name, list]) => (
              <section key={name} className="index-group">
                <div className="section-head">
                  <h2 className="section-title">{name}</h2>
                  <span className="muted small">{lessonCount(name, list.length)}</span>
                </div>
                <ul className="entry-list card index-card">
                  {list.map((l) => (
                    <TitleRow key={l.slug} lesson={l} />
                  ))}
                </ul>
              </section>
            ))
          ) : (
            <div className="stack">
              {lessons.map((l) => (
                <LessonCard key={l.slug} lesson={l} />
              ))}
            </div>
          )}
          <Pagination base={href(view)} noun="lessons" {...pager} />
        </div>

        <aside className="sidebar">
          <SubscribeForm />
        </aside>
      </div>
    </>
  );
}
