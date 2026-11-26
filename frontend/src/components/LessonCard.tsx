import Link from "next/link";
import type { PostMeta } from "@/lib/posts";
import { formatDate } from "@/lib/format";

export default function LessonCard({ lesson, featured = false }: { lesson: PostMeta; featured?: boolean }) {
  return (
    <article className="card post-card">
      <div className="card-body">
        <p className="meta">
          {featured && <span className="badge">Today&apos;s lesson</span>}
          <time dateTime={lesson.date}>{formatDate(lesson.date)}</time> · {lesson.readingMinutes} min read
        </p>
        <h3 className="post-card-title">
          <Link href={`/daily/lessons/${lesson.slug}`}>{lesson.title}</Link>
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
      </div>
    </article>
  );
}
