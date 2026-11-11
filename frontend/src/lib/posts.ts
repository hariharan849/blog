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
  title: string;
  date: string;
  summary: string;
  tags: string[];
  draft: boolean;
  readingMinutes: number;
};

export type Post = PostMeta & { html: string };

const POSTS_DIR = path.join(process.cwd(), "content", "posts");
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function toDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value ?? "").slice(0, 10);
}

function read(file: string): Post {
  const slug = file.replace(/\.mdx?$/, "");
  const raw = fs.readFileSync(path.join(POSTS_DIR, file), "utf8");
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
    html: marked.parse(content, { async: false }) as string,
  };
}

function all(): Post[] {
  if (!fs.existsSync(POSTS_DIR)) return [];
  const showDrafts = process.env.NODE_ENV !== "production";
  return fs
    .readdirSync(POSTS_DIR)
    .filter((f) => /\.mdx?$/.test(f) && SLUG_RE.test(f.replace(/\.mdx?$/, "")))
    .map(read)
    .filter((p) => showDrafts || !p.draft)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function getPosts(): PostMeta[] {
  return all().map(({ html: _html, ...meta }) => meta);
}

export function getPost(slug: string): Post | undefined {
  if (!SLUG_RE.test(slug)) return undefined;
  return all().find((p) => p.slug === slug);
}

export function getTags(): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const p of getPosts()) for (const t of p.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts].map(([tag, count]) => ({ tag, count })).sort((a, b) => a.tag.localeCompare(b.tag));
}
