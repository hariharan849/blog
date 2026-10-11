import Link from "next/link";

import { buttonSecondary } from "@/lib/ui";

export default function Pagination({ page, numPages, basePath, params = {} }: {
  page: number;
  numPages: number;
  basePath: string;
  params?: Record<string, string>;
}) {
  if (numPages <= 1) return null;
  const href = (target: number) => `${basePath}?${new URLSearchParams({ ...params, page: String(target) })}`;
  return (
    <nav className="mt-8 flex items-center justify-between" aria-label="Pagination">
      {page > 1 ? <Link className={buttonSecondary} href={href(page - 1)}>← Previous</Link> : <span />}
      <span className="text-sm text-zinc-500">Page {page} of {numPages}</span>
      {page < numPages ? <Link className={buttonSecondary} href={href(page + 1)}>Next →</Link> : <span />}
    </nav>
  );
}
