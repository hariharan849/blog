export interface TocEntry {
  id: string;
  text: string;
  level: 2 | 3;
}

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " " };

function plainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (entity) => ENTITIES[entity] ?? entity)
    .replace(/\s+/g, " ")
    .trim();
}

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "section"
  );
}

/**
 * Give every h2/h3 in (already sanitised) post HTML a unique id and return the table of contents.
 * Only slugified text ([a-z0-9-]) is inserted, so the HTML stays safe.
 */
export function withHeadingIds(html: string): { html: string; toc: TocEntry[] } {
  const toc: TocEntry[] = [];
  const used = new Map<string, number>();
  const output = html.replace(/<h([23])((?:\s[^>]*)?)>([\s\S]*?)<\/h\1>/gi, (match, level: string, attrs: string, inner: string) => {
    const text = plainText(inner);
    if (!text) return match;
    const base = slugify(text);
    const count = used.get(base) ?? 0;
    used.set(base, count + 1);
    const id = count ? `${base}-${count + 1}` : base;
    toc.push({ id, text, level: Number(level) as 2 | 3 });
    const cleanAttrs = (attrs ?? "").replace(/\sid="[^"]*"/i, "");
    return `<h${level} id="${id}"${cleanAttrs}>${inner}</h${level}>`;
  });
  return { html: output, toc };
}
