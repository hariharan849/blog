import "server-only";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { marked } from "marked";

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
  title: string;
  date: string;
  summary: string;
  tags: string[];
  draft: boolean;
  readingMinutes: number;
};

export type Post = PostMeta & { html: string };

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function toDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value ?? "").slice(0, 10);
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
    html: marked.parse(content, { async: false }) as string,
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
    list: (): PostMeta[] => all().map(({ html: _html, ...meta }) => meta),
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

export const getLessons = lessons.list;
export const getLesson = lessons.get;

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
