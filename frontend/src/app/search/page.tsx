import type { Metadata } from "next";
import Link from "next/link";
import { search, termRegex, tokenize, type SearchKind } from "@/lib/search";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Search", robots: { index: false } };

type Props = { searchParams: Promise<{ q?: string; type?: string }> };

const KINDS: { id: SearchKind; label: string }[] = [
  { id: "Project", label: "Projects" },
  { id: "Lesson", label: "Lessons" },
  { id: "Blog", label: "Blog" },
];

const SUGGESTIONS = ["agents", "RAG", "LangGraph", "MLOps", "vLLM", "durable execution"];

/** Wraps each query term found in `text` in <mark>, without using raw HTML. */
function Highlight({ text, terms }: { text: string; terms: string[] }) {
  if (!terms.length) return <>{text}</>;
  const parts = text.split(termRegex(terms));
  return (
    <>
      {parts.map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : p))}
    </>
  );
}

export default async function SearchPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = (params.q ?? "").slice(0, 120).trim();
  const kind = KINDS.find((k) => k.id.toLowerCase() === params.type?.toLowerCase())?.id;
  const all = q ? search(q) : [];
  const hits = kind ? all.filter((h) => h.kind === kind) : all;
  const terms = tokenize(q);
  const href = (type?: string) => `/search?${new URLSearchParams({ q, ...(type ? { type: type.toLowerCase() } : {}) })}`;

  return (
    <>
      <section className="hero">
        <p className="eyebrow">Search</p>
        <h1>{q ? <>Results for &ldquo;{q}&rdquo;</> : "Search the site"}</h1>
        <form action="/search" role="search" className="search-form">
          <label htmlFor="search-page-q" className="visually-hidden">
            Search projects, lessons and posts
          </label>
          <input id="search-page-q" name="q" type="search" defaultValue={q} placeholder="Search projects, lessons and posts" autoFocus={!q} />
          {kind && <input type="hidden" name="type" value={kind.toLowerCase()} />}
          <button type="submit" className="button">
            Search
          </button>
        </form>
      </section>

      {q ? (
        <>
          <nav className="view-tabs" aria-label="Filter results">
            <Link href={href()} className={kind ? undefined : "active"} aria-current={kind ? undefined : "page"}>
              All <span className="chip-count">{all.length}</span>
            </Link>
            {KINDS.map((k) => (
              <Link
                key={k.id}
                href={href(k.id)}
                className={kind === k.id ? "active" : undefined}
                aria-current={kind === k.id ? "page" : undefined}
              >
                {k.label} <span className="chip-count">{all.filter((h) => h.kind === k.id).length}</span>
              </Link>
            ))}
          </nav>

          {hits.length ? (
            <ol className="search-results">
              {hits.map((h) => (
                <li key={h.href} className="card search-hit">
                  <div className="card-body">
                    <p className="meta">
                      <span className={`badge${h.kind === "Project" ? "" : " badge-muted"}`}>{h.kind}</span>
                      {h.author && <span>{h.author}</span>}
                      {h.date && <time dateTime={h.date}>{formatDate(h.date)}</time>}
                    </p>
                    <h2 className="tile-title">
                      {h.external ? (
                        <a href={h.href} target="_blank" rel="noopener noreferrer">
                          <Highlight text={h.title} terms={terms} /> <span aria-hidden="true">↗</span>
                        </a>
                      ) : (
                        <Link href={h.href}>
                          <Highlight text={h.title} terms={terms} />
                        </Link>
                      )}
                    </h2>
                    <p className="excerpt">
                      <Highlight text={h.snippet} terms={terms} />
                    </p>
                    {h.tags.length > 0 && (
                      <p className="tag-row">
                        {h.tags.slice(0, 5).map((t) => (
                          <span key={t} className="badge badge-muted">
                            {t}
                          </span>
                        ))}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="search-empty">
              <p className="muted">
                Nothing matched &ldquo;{q}&rdquo;{kind ? ` in ${KINDS.find((k) => k.id === kind)?.label}` : ""}. Try a
                broader word, or one of these:
              </p>
              <Suggestions />
            </div>
          )}
        </>
      ) : (
        <div className="search-empty">
          <p className="muted">Search titles, tags, authors and the full text of every lesson and post. Popular topics:</p>
          <Suggestions />
        </div>
      )}
    </>
  );
}

function Suggestions() {
  return (
    <p className="tag-row">
      {SUGGESTIONS.map((s) => (
        <Link key={s} href={`/search?q=${encodeURIComponent(s)}`} className="chip">
          {s}
        </Link>
      ))}
    </p>
  );
}
