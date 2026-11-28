import Link from "next/link";
import { withPage } from "@/lib/paginate";

/** Page numbers to show: always the first and last, the current page with one neighbour each side, gaps as null. */
function pageList(page: number, total: number): (number | null)[] {
  const wanted = new Set([1, total, page - 1, page, page + 1].filter((n) => n >= 1 && n <= total));
  const sorted = [...wanted].sort((a, b) => a - b);
  const out: (number | null)[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push(n - sorted[i - 1] === 2 ? n - 1 : null);
    out.push(n);
  });
  return out;
}

type Props = {
  /** Path (with any other query params) the page number is added to, e.g. "/blog" or "/search?q=rag". */
  base: string;
  page: number;
  totalPages: number;
  total: number;
  from: number;
  to: number;
  /** Plural noun for the summary line, e.g. "posts". */
  noun: string;
};

/** Numbered pagination: "Showing 11–20 of 42 posts" plus Previous, page numbers and Next. */
export default function Pagination({ base, page, totalPages, total, from, to, noun }: Props) {
  if (totalPages <= 1) return null;
  return (
    <nav className="pager" aria-label="Pagination">
      <p className="pager-summary">
        Showing {from}–{to} of {total} {noun}
      </p>
      <ul className="pager-list">
        <li>
          {page > 1 ? (
            <Link href={withPage(base, page - 1)} rel="prev" className="pager-link pager-step">
              <span aria-hidden="true">←</span> <span className="pager-step-text">Previous</span>
            </Link>
          ) : (
            <span className="pager-link pager-step pager-disabled" aria-disabled="true">
              <span aria-hidden="true">←</span> <span className="pager-step-text">Previous</span>
            </span>
          )}
        </li>
        {pageList(page, totalPages).map((n, i) =>
          n === null ? (
            <li key={`gap-${i}`} className="pager-gap" aria-hidden="true">
              …
            </li>
          ) : (
            <li key={n}>
              {n === page ? (
                <span className="pager-link pager-current" aria-current="page">
                  {n}
                </span>
              ) : (
                <Link href={withPage(base, n)} className="pager-link" aria-label={`Page ${n}`}>
                  {n}
                </Link>
              )}
            </li>
          ),
        )}
        <li>
          {page < totalPages ? (
            <Link href={withPage(base, page + 1)} rel="next" className="pager-link pager-step">
              <span className="pager-step-text">Next</span> <span aria-hidden="true">→</span>
            </Link>
          ) : (
            <span className="pager-link pager-step pager-disabled" aria-disabled="true">
              <span className="pager-step-text">Next</span> <span aria-hidden="true">→</span>
            </span>
          )}
        </li>
      </ul>
    </nav>
  );
}
