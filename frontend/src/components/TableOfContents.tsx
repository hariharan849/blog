import type { TocEntry } from "@/lib/posts";

/** "On this page" list for long posts and lessons. Hidden when there are fewer than three sections. */
export default function TableOfContents({ toc }: { toc: TocEntry[] }) {
  if (toc.length < 3) return null;
  return (
    <details className="toc" open>
      <summary>On this page</summary>
      <ol>
        {toc.map((t) => (
          <li key={t.id} className={t.depth === 3 ? "toc-sub" : undefined}>
            <a href={`#${t.id}`}>{t.text}</a>
          </li>
        ))}
      </ol>
    </details>
  );
}
