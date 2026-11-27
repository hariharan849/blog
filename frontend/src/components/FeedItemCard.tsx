import type { FeedItem } from "@/lib/feed";
import { formatDate } from "@/lib/format";

const KIND_LABEL = { medium: "Medium", substack: "Substack", rss: "Blog" } as const;

export default function FeedItemCard({ item }: { item: FeedItem }) {
  const label = KIND_LABEL[item.kind] ?? "Blog";
  return (
    <article className={`card ${item.image ? "row-card" : "tile"}`}>
      {item.image && (
        <a href={item.url} target="_blank" rel="noopener noreferrer" className="row-card-cover" tabIndex={-1}>
          {/* eslint-disable-next-line @next/next/no-img-element -- remote images from arbitrary feeds */}
          <img src={item.image} alt="" className="row-card-img" loading="lazy" referrerPolicy="no-referrer" />
        </a>
      )}
      <div className="card-body row-card-body">
        <p className="meta">
          <span className={`badge badge-${item.kind}`}>{label}</span>
          <span>{item.author || item.source_title}</span>·
          <time dateTime={item.published_at}>{formatDate(item.published_at)}</time>
        </p>
        <h3 className="tile-title">
          <a href={item.url} target="_blank" rel="noopener noreferrer">
            {item.title} <span aria-hidden="true">↗</span>
          </a>
        </h3>
        {item.excerpt && <p className="excerpt clamp-3">{item.excerpt}</p>}
      </div>
    </article>
  );
}
