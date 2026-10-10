import { notFound } from "next/navigation";

import DigestView from "@/components/bytes/DigestView";
import { apiGetOrNull } from "@/lib/server-api";
import type { Digest } from "@/lib/types";

export default async function BytesDayPage({ params }: PageProps<"/bytes/[date]">) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();
  const digest = await apiGetOrNull<Digest>(`/api/v1/bytes/digests/${date}/`, { withCookies: true });
  if (!digest) notFound();
  return <DigestView digest={digest} isLatest={false} />;
}
