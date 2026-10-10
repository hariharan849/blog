import Link from "next/link";

import Pagination from "@/components/Pagination";
import { formatDate } from "@/lib/format";
import { apiGet, query } from "@/lib/server-api";
import type { DigestSummary, Page } from "@/lib/types";

export const metadata = { title: "Archive" };

export default async function ArchivePage({ searchParams }: PageProps<"/bytes/archive">) {
  const { page } = await searchParams;
  const digests = await apiGet<Page<DigestSummary>>(`/api/v1/bytes/digests/${query({ page })}`, { withCookies: true });
  return (
    <>
      <div className="list-group">
        {digests.results.length ? (
          digests.results.map((digest) => (
            <Link key={digest.date} className="list-group-item list-group-item-action" href={`/bytes/${digest.date}/`}>
              <strong>{formatDate(digest.date)}</strong> — {digest.headline}
            </Link>
          ))
        ) : (
          <p className="text-muted">No digests yet.</p>
        )}
      </div>
      <Pagination page={digests.page} numPages={digests.num_pages} basePath="/bytes/archive/" />
    </>
  );
}
