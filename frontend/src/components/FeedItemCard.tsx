import type { FeedItem } from "@/lib/feed";
import { formatDate } from "@/lib/format";

const KIND_LABEL = { medium: "Medium", substack: "Substack", rss: "Blog" } as const;

export default function FeedItemCard({ item }: { item: FeedItem }) {
  return (
    <article className="card feed-item">
      <div className="card-body feed-item-body">
        <div>
          <p className="meta">
            <span className={`badge badge-${item.kind}`}>{KIND_LABEL[item.kind] ?? "Blog"}</span>
            <span>{item.author || item.source_title}</span>·
            <time dateTime={item.published_at}>{formatDate(item.published_at)}</time>
          </p>
          <h3 className="feed-item-title">
            <a href={item.url} target="_blank" rel="noopener noreferrer">
              {item.title} <span aria-hidden="true">↗</span>
            </a>
          </h3>
          {item.excerpt && <p className="excerpt">{item.excerpt}</p>}
        </div>
        {item.image && (
          // eslint-disable-next-line @next/next/no-img-element -- remote images from arbitrary feeds
          <img src={item.image} alt="" className="feed-thumb" loading="lazy" referrerPolicy="no-referrer" />
        )}
      </div>
    </article>
  );
}
