import Link from "next/link";
import type { PostMeta } from "@/lib/posts";
import { formatDate } from "@/lib/format";
import Cover from "./Cover";

/** A Daily Dose lesson. `featured` draws the wide, cover-first spotlight card. */
export default function LessonCard({ lesson, featured = false }: { lesson: PostMeta; featured?: boolean }) {
  const href = `/daily/lessons/${lesson.slug}`;
  return (
    <article className={`card ${featured ? "row-card row-card-featured" : "tile"}`}>
      {featured && (
        <Link href={href} className="row-card-cover" tabIndex={-1}>
          <Cover label="Daily lesson" title={lesson.tags[0] ? `#${lesson.tags[0]}` : "Lesson"} tone="royal" size="lg" />
        </Link>
      )}
      <div className="card-body row-card-body">
        <p className="meta">
          {featured && <span className="badge">Today&apos;s lesson</span>}
          <time dateTime={lesson.date}>{formatDate(lesson.date)}</time> · {lesson.readingMinutes} min read
        </p>
        <h3 className="tile-title">
          <Link href={href}>{lesson.title}</Link>
        </h3>
        {lesson.summary && <p className="excerpt">{lesson.summary}</p>}
        {lesson.tags.length > 0 && (
          <p className="tag-row">
            {lesson.tags.map((t) => (
              <span key={t} className="badge badge-muted">
                #{t}
              </span>
            ))}
          </p>
        )}
        <Link href={href} className="read-more">
          Read the lesson <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  );
}
