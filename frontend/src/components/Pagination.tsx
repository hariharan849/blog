import Link from "next/link";

export default function Pagination({
  page,
  numPages,
  basePath,
  params = {},
}: {
  page: number;
  numPages: number;
  basePath: string;
  params?: Record<string, string | undefined>;
}) {
  if (numPages <= 1) return null;
  const href = (p: number) => {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) search.set(k, v);
    if (p > 1) search.set("page", String(p));
    const s = search.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  return (
    <nav className="pagination" aria-label="Pagination">
      {page > 1 ? <Link href={href(page - 1)}>← Newer</Link> : <span />}
      <span className="muted">
        Page {page} of {numPages}
      </span>
      {page < numPages ? <Link href={href(page + 1)}>Older →</Link> : <span />}
    </nav>
  );
}
