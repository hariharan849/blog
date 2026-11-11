import "server-only";

/** Client for the Daily Dose API (AWS Lambda behind API Gateway, see /backend). */

export type SourceKind = "medium" | "substack" | "rss";

export type FeedItem = {
  id: string;
  url: string;
  title: string;
  author?: string;
  excerpt?: string;
  image?: string;
  published_at: string;
  source_id: string;
  source_title?: string;
  kind: SourceKind;
  day: string;
};

export type FeedDay = {
  day: string | null;
  items: FeedItem[];
  prev_day: string | null;
  next_day: string | null;
};

export type Source = {
  id: string;
  kind: SourceKind;
  value: string;
  feed_url: string;
  title: string;
  site_url?: string;
  enabled: boolean;
  created_at: string;
  last_checked_at?: string;
  last_error?: string;
  last_new_count?: number;
};

export class FeedApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const API_URL = (process.env.FEED_API_URL ?? "").replace(/\/$/, "");
export const feedConfigured = Boolean(API_URL);

async function request<T>(path: string, init: RequestInit & { admin?: boolean; revalidate?: number } = {}) {
  if (!API_URL) throw new FeedApiError(503, "FEED_API_URL is not configured");
  const { admin, revalidate, headers, ...rest } = init;
  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      Accept: "application/json",
      ...(rest.body ? { "Content-Type": "application/json" } : {}),
      ...(admin ? { Authorization: `Bearer ${process.env.FEED_ADMIN_TOKEN ?? ""}` } : {}),
      ...headers,
    },
    ...(admin ? { cache: "no-store" as const } : { next: { revalidate: revalidate ?? 300, tags: ["feed"] } }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new FeedApiError(res.status, (data as { error?: string; message?: string }).error ?? (data as { message?: string }).message ?? `Request failed (${res.status})`);
  return data as T;
}

export const feedApi = {
  day: (day?: string) => request<FeedDay>(`/feed${day ? `?day=${encodeURIComponent(day)}` : ""}`),
  days: (limit = 30) => request<{ days: { day: string; count: number }[] }>(`/feed/days?limit=${limit}`).then((r) => r.days),

  // Admin-only: called from server actions after the session is checked.
  sources: () => request<{ sources: Source[] }>("/sources", { admin: true }).then((r) => r.sources),
  addSource: (kind: SourceKind, value: string) =>
    request<{ source: Source; preview: string[] }>("/sources", {
      admin: true,
      method: "POST",
      body: JSON.stringify({ kind, value }),
    }),
  updateSource: (id: string, fields: { enabled?: boolean; title?: string }) =>
    request<{ source: Source }>(`/sources/${encodeURIComponent(id)}`, {
      admin: true,
      method: "PATCH",
      body: JSON.stringify(fields),
    }),
  deleteSource: (id: string) =>
    request<{ deleted: string }>(`/sources/${encodeURIComponent(id)}`, { admin: true, method: "DELETE" }),
  runNow: () => request<{ status: string }>("/ingest", { admin: true, method: "POST" }),
};

export async function safeFeed<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch (err) {
    if (feedConfigured) console.error(err);
    return null;
  }
}
