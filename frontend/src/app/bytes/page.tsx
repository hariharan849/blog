import Link from "next/link";

import DigestView from "@/components/bytes/DigestView";
import { apiGetOrNull } from "@/lib/server-api";
import type { Digest } from "@/lib/types";

export default async function BytesTodayPage() {
  const digest = await apiGetOrNull<Digest>("/api/v1/bytes/digests/latest/", { withCookies: true });
  if (!digest) {
    return (
      <div className="rounded-3xl border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
        <p className="font-serif text-2xl font-semibold">No digest yet</p>
        <p className="mx-auto mt-3 max-w-md text-zinc-500">
          <Link href="/bytes/sources/" className="text-indigo-600 dark:text-indigo-400">Add the writers and publications you follow</Link>, then run{" "}
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm dark:bg-zinc-800">python manage.py run_daily_bytes</code>.
        </p>
      </div>
    );
  }
  return <DigestView digest={digest} isLatest />;
}
