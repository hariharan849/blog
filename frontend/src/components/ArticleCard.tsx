import type { Article } from "@/lib/medium";
import { formatDate } from "@/lib/format";
import Cover from "./Cover";

/** One of hari's own articles. Opens on Medium. */
export default function ArticleCard({ article }: { article: Article }) {
  return (
    <article className="card tile">
      <a href={article.url} target="_blank" rel="noopener" tabIndex={-1} aria-hidden="true" className="article-cover">
        {article.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={article.image} alt="" className="article-image" loading="lazy" />
        ) : (
          <Cover label="Article" title={article.title.split(/[\s:—-]+/)[0]} />
        )}
      </a>
      <div className="card-body tile-body">
        <p className="meta">
          <time dateTime={article.date}>{formatDate(article.date)}</time> · {article.readingMinutes} min read
        </p>
        <h3 className="tile-title">
          <a href={article.url} target="_blank" rel="noopener">
            {article.title}
          </a>
        </h3>
        {article.summary && <p className="excerpt">{article.summary}</p>}
        {article.tags.length > 0 && (
          <p className="tag-row">
            {article.tags.map((t) => (
              <span key={t} className="badge badge-muted">
                #{t}
              </span>
            ))}
          </p>
        )}
        <a href={article.url} target="_blank" rel="noopener" className="read-more">
          Read on Medium <span aria-hidden="true">↗</span>
        </a>
      </div>
    </article>
  );
}
