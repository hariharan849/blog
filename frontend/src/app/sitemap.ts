import type { MetadataRoute } from "next";
import { getLessons, getPosts, getTags } from "@/lib/posts";
import { SITE_URL } from "@/lib/format";

/** /sitemap.xml: every public page, rebuilt on each deploy (new lessons are committed, which redeploys). */
export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getPosts().filter((p) => !p.draft);
  const lessons = getLessons().filter((l) => !l.draft);
  const latest = [...posts, ...lessons].map((p) => p.date).sort().at(-1);

  const page = (path: string, lastModified?: string, priority = 0.5): MetadataRoute.Sitemap[number] => ({
    url: `${SITE_URL}${path}`,
    ...(lastModified ? { lastModified } : {}),
    priority,
  });

  return [
    page("/", latest, 1),
    page("/about", undefined, 0.8),
    page("/projects", undefined, 0.8),
    page("/blog", posts[0]?.date, 0.7),
    page("/articles", undefined, 0.6),
    page("/daily", lessons[0]?.date, 0.7),
    page("/daily/lessons", lessons[0]?.date, 0.7),
    ...posts.map((p) => page(`/blog/${p.slug}`, p.date, 0.6)),
    ...getTags().map(({ tag }) => page(`/blog/tag/${tag}`, undefined, 0.3)),
    ...lessons.map((l) => page(`/daily/lessons/${l.slug}`, l.date, 0.6)),
  ];
}
