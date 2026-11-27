import "server-only";
import { profile } from "./profile";

/** One of hari's own articles, read from their Medium RSS feed. */
export type Article = {
  id: string;
  title: string;
  url: string;
  date: string;
  summary: string;
  image?: string;
  tags: string[];
  readingMinutes: number;
};

export const MEDIUM_PROFILE_URL = `https://medium.com/@${profile.medium}`;
// MEDIUM_FEED_URL overrides the feed, e.g. a local copy while testing.
const FEED_URL = process.env.MEDIUM_FEED_URL ?? `https://medium.com/feed/@${profile.medium}`;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decode(s: string) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

function text(html: string) {
  return decode(html.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function field(item: string, tag: string) {
  const m = item.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`));
  return m ? m[1].trim() : "";
}

/** The first real paragraph, skipping link-only lines such as "Source: https://…". */
function summarize(html: string) {
  for (const [, p] of html.matchAll(/<p>([\s\S]*?)<\/p>/g)) {
    const t = text(p);
    if (t.length >= 80 && !/https?:\/\//.test(t))
      return t.length > 220 ? `${t.slice(0, 217).replace(/\s+\S*$/, "")}…` : t;
  }
  return "";
}

function cleanUrl(url: string) {
  try {
    const u = new URL(decode(url));
    u.search = "";
    return u.toString();
  } catch {
    return url;
  }
}

export function parseMediumFeed(xml: string): Article[] {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, item]) => {
    const content = field(item, "content:encoded");
    // The first picture in the post, skipping Medium's view-tracking pixel.
    const image = [...content.matchAll(/<img[^>]+src="([^"]+)"/g)]
      .map(([, src]) => src)
      .find((src) => /^https:\/\/(cdn-images-\d+|miro)\.medium\.com\//.test(src));
    const words = text(content).split(" ").filter(Boolean).length;
    return {
      id: field(item, "guid"),
      title: decode(field(item, "title")),
      url: cleanUrl(field(item, "link")),
      date: new Date(field(item, "pubDate")).toISOString(),
      summary: summarize(content),
      image,
      tags: [...item.matchAll(/<category>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/category>/g)].map(([, c]) =>
        decode(c.trim()),
      ),
      readingMinutes: Math.max(1, Math.round(words / 220)),
    };
  });
}

/** hari's latest Medium articles (Medium's feed lists the newest 10). Empty if Medium can't be reached. */
export async function getArticles(): Promise<Article[]> {
  try {
    const res = await fetch(FEED_URL, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    return parseMediumFeed(await res.text());
  } catch {
    return [];
  }
}
