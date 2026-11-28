import Link from "next/link";
import type { RelatedItem } from "@/lib/posts";
import { formatDate } from "@/lib/format";

/** "Keep reading" cards at the end of a post or lesson. */
export default function RelatedReading({ items }: { items: RelatedItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className="related" aria-labelledby="related-heading">
      <h2 id="related-heading">Keep reading</h2>
      <ul>
        {items.map((i) => (
          <li key={i.href}>
            <Link href={i.href} className="related-card">
              <span className="related-kind">{i.kind === "lesson" ? "Daily lesson" : "Blog post"}</span>
              <span className="related-title">{i.title}</span>
              <span className="related-meta">
                <time dateTime={i.date}>{formatDate(i.date)}</time> · {i.readingMinutes} min read
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
