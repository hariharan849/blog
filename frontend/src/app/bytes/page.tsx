import Link from "next/link";

import DigestView from "@/components/bytes/DigestView";
import { apiGetOrNull } from "@/lib/server-api";
import type { Digest } from "@/lib/types";

export default async function BytesTodayPage() {
  const digest = await apiGetOrNull<Digest>("/api/v1/bytes/digests/latest/", { withCookies: true });
  if (!digest) {
    return (
      <div className="alert alert-info">
        No digest yet. <Link href="/bytes/sources/">Add the writers and publications you follow</Link>, then run{" "}
        <code>python manage.py run_daily_bytes</code>.
      </div>
    );
  }
  return <DigestView digest={digest} isLatest />;
}
