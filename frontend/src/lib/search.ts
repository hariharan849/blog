import "server-only";
import { getArticles } from "./medium";
import { getFullLessons, getFullPosts } from "./posts";
import { projects } from "./projects";

/**
 * Site search over projects, blog posts, Daily Dose lessons and hari's own
 * Medium articles (titles, tags and summaries, from the cached feed). Runs on the server per request, so there is no index to
 * build or ship to the browser. Add a new kind of content by adding its docs to
 * `documents()`.
 */
export type SearchKind = "Project" | "Article" | "Blog" | "Lesson";

export type SearchDoc = {
  kind: SearchKind;
  title: string;
  href: string;
  external?: boolean;
  date?: string;
  author?: string;
  summary: string;
  tags: string[];
  body: string;
};

export type SearchHit = SearchDoc & { score: number; snippet: string };

const stripHtml = (html: string) =>
  html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

async function documents(): Promise<SearchDoc[]> {
  const articles = await getArticles();
  return [
    ...projects.map((p) => ({
      kind: "Project" as const,
      title: p.name,
      href: p.repo,
      external: true,
      summary: p.summary,
      tags: [p.category, ...p.tags],
      body: "",
    })),
    ...articles.map((a) => ({
      kind: "Article" as const,
      title: a.title,
      href: a.url,
      external: true,
      date: a.date,
      summary: a.summary,
      tags: a.tags,
      body: "",
    })),
    ...getFullPosts().map((p) => ({
      kind: "Blog" as const,
      title: p.title,
      href: `/blog/${p.slug}`,
      date: p.date,
      summary: p.summary,
      tags: p.tags,
      body: stripHtml(p.html),
    })),
    ...getFullLessons().map((l) => ({
      kind: "Lesson" as const,
      title: l.title,
      href: `/daily/lessons/${l.slug}`,
      date: l.date,
      author: l.sourceAuthor,
      summary: l.summary,
      tags: l.tags,
      body: stripHtml(l.html),
    })),
  ];
}

const escapeRe = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Matches a term at the start of a word, so "rag" finds "RAG" but not "storage". */
export const termRegex = (terms: string[], flags = "gi") =>
  new RegExp(`(?<![a-z0-9])(${terms.map(escapeRe).join("|")})`, flags);

export const tokenize = (q: string) =>
  [...new Set(q.toLowerCase().split(/[^a-z0-9+#.]+/i).map((t) => t.replace(/^\.+|\.+$/g, "")).filter((t) => t.length > 1))].slice(0, 8);

function snippetFor(doc: SearchDoc, terms: string[]) {
  const text = doc.body || doc.summary;
  const lower = text.toLowerCase();
  const at = lower.search(termRegex(terms, "i"));
  if (!doc.body || at < 0) return doc.summary || text.slice(0, 200);
  const start = Math.max(0, text.lastIndexOf(" ", Math.max(0, at - 80)) + 1);
  const end = Math.min(text.length, start + 220);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

/** Every term must appear somewhere; title and tag matches rank above body matches. */
export async function search(query: string, kind?: SearchKind): Promise<SearchHit[]> {
  const terms = tokenize(query);
  if (!terms.length) return [];
  const hits: SearchHit[] = [];
  for (const doc of await documents()) {
    if (kind && doc.kind !== kind) continue;
    const fields = {
      title: doc.title.toLowerCase(),
      meta: [...doc.tags, doc.author ?? ""].join(" ").toLowerCase(),
      summary: doc.summary.toLowerCase(),
      body: doc.body.toLowerCase(),
    };
    let score = 0;
    let all = true;
    for (const t of terms) {
      const re = termRegex([t], "g");
      const has = (f: string) => f.search(re) >= 0;
      const s =
        (has(fields.title) ? 10 : 0) +
        (has(fields.meta) ? 6 : 0) +
        (has(fields.summary) ? 3 : 0) +
        Math.min(fields.body.match(re)?.length ?? 0, 5);
      if (!s) {
        all = false;
        break;
      }
      score += s;
    }
    if (!all) continue;
    if (fields.title.includes(query.trim().toLowerCase())) score += 15;
    hits.push({ ...doc, score, snippet: snippetFor(doc, terms) });
  }
  return hits.sort((a, b) => b.score - a.score || (b.date ?? "").localeCompare(a.date ?? ""));
}
