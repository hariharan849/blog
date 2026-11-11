import "server-only";

export type Author = { username: string; name: string; post_count?: number };
export type Category = { name: string; slug: string; post_count?: number };
export type Tag = { name: string; slug: string };

export type PostSummary = {
  title: string;
  slug: string;
  excerpt: string;
  image: string | null;
  author: Author;
  category: Category | null;
  tags: Tag[];
  created_at: string;
  updated_at: string;
};

export type Comment = { id: number; name: string; content: string; created_at: string };

export type PostDetail = PostSummary & {
  content: string;
  related: PostSummary[];
  comments: Comment[];
};

export type Paginated<T> = { results: T[]; page: number; num_pages: number; count: number };

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const API_URL = (process.env.API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

async function get<T>(path: string, revalidate = 60): Promise<T> {
  const res = await fetch(`${API_URL}/api${path}`, {
    next: { revalidate },
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new ApiError(res.status, `GET ${path} failed with ${res.status}`);
  return res.json() as Promise<T>;
}

function qs(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : "";
}

export type PostFilters = {
  q?: string;
  category?: string;
  tag?: string;
  author?: string;
  page?: number;
  page_size?: number;
};

export const api = {
  posts: (filters: PostFilters = {}) => get<Paginated<PostSummary>>(`/posts/${qs(filters)}`),
  post: (slug: string) => get<PostDetail>(`/posts/${encodeURIComponent(slug)}/`, 30),
  categories: () => get<{ results: Category[] }>("/categories/", 300).then((r) => r.results),
  tags: () => get<{ results: Tag[] }>("/tags/", 300).then((r) => r.results),
  authors: () => get<{ results: Author[] }>("/authors/", 300).then((r) => r.results),
  recent: (limit = 5) => get<{ results: PostSummary[] }>(`/recent/${qs({ limit })}`).then((r) => r.results),

  async addComment(slug: string, body: { name: string; email: string; content: string }) {
    const res = await fetch(`${API_URL}/api/posts/${encodeURIComponent(slug)}/comments/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data } as {
      ok: boolean;
      status: number;
      data: Comment | { errors?: Record<string, string>; error?: string };
    };
  },
};

/** Wraps an API call so a down backend renders an empty state instead of crashing a page. */
export async function safe<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch (err) {
    console.error(err);
    return fallback;
  }
}
