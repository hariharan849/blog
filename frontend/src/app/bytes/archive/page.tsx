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
      <ol className="relative space-y-1 border-l border-zinc-200 pl-6 dark:border-zinc-800">
        {digests.results.length ? (
          digests.results.map((digest) => (
            <li key={digest.date} className="relative">
              <span aria-hidden className="absolute -left-[29px] top-4 size-2.5 rounded-full border-2 border-white bg-indigo-500 dark:border-zinc-950" />
              <Link className="block rounded-xl px-4 py-3 transition hover:bg-zinc-50 dark:hover:bg-zinc-900" href={`/bytes/${digest.date}/`}>
                <span className="text-xs text-zinc-500">{formatDate(digest.date)}</span>
                <span className="block font-medium">{digest.headline}</span>
              </Link>
            </li>
          ))
        ) : (
          <p className="text-zinc-500">No digests yet.</p>
        )}
      </ol>
      <Pagination page={digests.page} numPages={digests.num_pages} basePath="/bytes/archive/" />
    </>
  );
}
