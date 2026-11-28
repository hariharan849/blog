import "server-only";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { Marked } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js/lib/common";

/** Markdown renderer with syntax highlighting for fenced code blocks (done at build time, no client JS). */
const marked = new Marked(
  markedHighlight({
    emptyLangClass: "hljs",
    langPrefix: "hljs language-",
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : "plaintext";
      return hljs.highlight(code, { language }).value;
    },
  }),
);

/**
 * Blog posts are Markdown files in /content/posts with front matter:
 *
 * ---
 * title: My post
 * date: 2026-11-11
 * summary: One-line description used in cards and metadata.
 * tags: [genai, agents]
 * draft: false        # optional; drafts are hidden in production
 * ---
 */
export type PostMeta = {
  slug: string;
  /** Lessons only: the YouTube video the lesson was written from. */
  youtubeId?: string;
  /** Lessons only: who wrote or presented the source (article, video or repo). */
  sourceAuthor?: string;
  /** Lessons only: the title of the source the lesson was written from. */
  sourceTitle?: string;
  title: string;
  date: string;
  summary: string;
  tags: string[];
  draft: boolean;
  readingMinutes: number;
};

export type TocEntry = { id: string; text: string; depth: 2 | 3 };

export type Post = PostMeta & { html: string; toc: TocEntry[] };

const decode = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

/** Give h2/h3 headings stable ids (for links and the table of contents) and list them. */
function withHeadingIds(html: string): { html: string; toc: TocEntry[] } {
  const toc: TocEntry[] = [];
  const used = new Map<string, number>();
  const out = html.replace(/<h([23])>([\s\S]*?)<\/h\1>/g, (_m, level: string, inner: string) => {
    const text = decode(inner.replace(/<[^>]+>/g, "")).trim();
    const base =
      text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "section";
    const n = used.get(base) ?? 0;
    used.set(base, n + 1);
    const id = n ? `${base}-${n}` : base;
    toc.push({ id, text, depth: Number(level) as 2 | 3 });
    return `<h${level} id="${id}">${inner}</h${level}>`;
  });
  return { html: out, toc };
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function toDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value ?? "").slice(0, 10);
}

/** Older lessons have no source_author/source_title; fall back to their credit line. */
const CREDIT_RE = /^\*Lesson from the (?:video|article) \[([^\]]+)\]\([^)]*\)(?: by (.+?))?\.\*\s*$/m;

function sourceInfo(data: Record<string, unknown>, content: string): { sourceAuthor?: string; sourceTitle?: string } {
  const credit = content.match(CREDIT_RE);
  const author = String(data.source_author ?? credit?.[2] ?? "").trim();
  const title = String(data.source_title ?? credit?.[1] ?? "").trim();
  return { ...(author ? { sourceAuthor: author } : {}), ...(title ? { sourceTitle: title } : {}) };
}

function read(dir: string, file: string): Post {
  const slug = file.replace(/\.mdx?$/, "");
  const raw = fs.readFileSync(path.join(dir, file), "utf8");
  const { data, content } = matter(raw);
  const words = content.split(/\s+/).filter(Boolean).length;
  return {
    slug,
    title: String(data.title ?? slug),
    date: toDate(data.date),
    summary: String(data.summary ?? ""),
    tags: Array.isArray(data.tags) ? data.tags.map((t: unknown) => String(t).toLowerCase()) : [],
    draft: Boolean(data.draft),
    readingMinutes: Math.max(1, Math.round(words / 220)),
    ...(data.youtube_id ? { youtubeId: String(data.youtube_id) } : {}),
    ...sourceInfo(data, content),
    ...withHeadingIds(marked.parse(content, { async: false }) as string),
  };
}

/** A folder of Markdown files under /content, newest first. */
function collection(name: string) {
  const dir = path.join(process.cwd(), "content", name);
  const all = (): Post[] => {
    if (!fs.existsSync(dir)) return [];
    const showDrafts = process.env.NODE_ENV !== "production";
    return fs
      .readdirSync(dir)
      .filter((f) => /\.mdx?$/.test(f) && SLUG_RE.test(f.replace(/\.mdx?$/, "")))
      .map((f) => read(dir, f))
      .filter((p) => showDrafts || !p.draft)
      .sort((a, b) => b.date.localeCompare(a.date) || b.slug.localeCompare(a.slug));
  };
  return {
    list: (): PostMeta[] => all().map(({ html: _html, toc: _toc, ...meta }) => meta),
    /** Every entry with its rendered HTML, for site search. */
    full: (): Post[] => all(),
    get: (slug: string): Post | undefined => (SLUG_RE.test(slug) ? all().find((p) => p.slug === slug) : undefined),
  };
}

/** The owner's own writing, shown under /blog. */
const posts = collection("posts");

/**
 * Daily lessons written from videos by lessons/make_lesson.py, shown in the
 * Daily Dose tab (/daily/lessons). Same front matter as posts, plus youtube_id.
 */
const lessons = collection("lessons");

/**
 * Optional project write-ups in /content/projects/<project-slug>.md, shown on
 * /projects/<slug> under the project summary. Same front matter as posts.
 */
const projectWriteups = collection("projects");
export const getProjectWriteup = projectWriteups.get;

export const getLessons = lessons.list;
export const getFullLessons = lessons.full;
export const getFullPosts = posts.full;
export const getLesson = lessons.get;

export const authorSlug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Lesson counts per source author, most lessons first. */
export function getLessonAuthors(): { author: string; slug: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const l of getLessons()) {
    const a = l.sourceAuthor ?? "Other sources";
    counts.set(a, (counts.get(a) ?? 0) + 1);
  }
  return [...counts]
    .map(([author, count]) => ({ author, slug: authorSlug(author), count }))
    .sort((a, b) => b.count - a.count || a.author.localeCompare(b.author));
}

export function getPosts(): PostMeta[] {
  return posts.list();
}

export function getPost(slug: string): Post | undefined {
  return posts.get(slug);
}

export function getTags(): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const p of getPosts()) for (const t of p.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts].map(([tag, count]) => ({ tag, count })).sort((a, b) => a.tag.localeCompare(b.tag));
}

export type RelatedItem = PostMeta & { kind: "post" | "lesson"; href: string };

/**
 * Up to `limit` posts and lessons to read next: most shared tags first, then
 * the same source author, then newest. Falls back to the latest entries when
 * nothing overlaps, so the section is never empty once there is other content.
 */
export function getRelated(kind: "post" | "lesson", slug: string, limit = 3): RelatedItem[] {
  const all: RelatedItem[] = [
    ...getPosts().map((p) => ({ ...p, kind: "post" as const, href: `/blog/${p.slug}` })),
    ...getLessons().map((l) => ({ ...l, kind: "lesson" as const, href: `/daily/lessons/${l.slug}` })),
  ];
  const self = all.find((i) => i.kind === kind && i.slug === slug);
  if (!self) return [];
  const tags = new Set(self.tags);
  const score = (i: RelatedItem) =>
    i.tags.filter((t) => tags.has(t)).length * 2 +
    (self.sourceAuthor && i.sourceAuthor === self.sourceAuthor ? 1 : 0) +
    (i.kind === kind ? 0.5 : 0);
  return all
    .filter((i) => i !== self)
    .map((i) => ({ i, s: score(i) }))
    .sort((a, b) => b.s - a.s || b.i.date.localeCompare(a.i.date))
    .slice(0, limit)
    .map(({ i }) => i);
}
