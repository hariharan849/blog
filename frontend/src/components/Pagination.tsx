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
  params?: Record<string, string>;
}) {
  if (numPages <= 1) return null;
  const href = (target: number) => `${basePath}?${new URLSearchParams({ ...params, page: String(target) })}`;
  return (
    <nav className="mt-3" aria-label="Pagination">
      <ul className="pagination">
        {page > 1 && (
          <li className="page-item"><Link className="page-link" href={href(page - 1)}>Previous</Link></li>
        )}
        <li className="page-item disabled"><span className="page-link">{page} / {numPages}</span></li>
        {page < numPages && (
          <li className="page-item"><Link className="page-link" href={href(page + 1)}>Next</Link></li>
        )}
      </ul>
    </nav>
  );
}
