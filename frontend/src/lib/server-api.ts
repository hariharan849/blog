import { cookies, headers } from "next/headers";

import { ApiError, errorFromResponse } from "./errors";
import type { AuthState, User } from "./types";

// Server components call Django directly (inside the container) instead of going through the proxy.
const BACKEND_URL = (process.env.BACKEND_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

async function forwardedHeaders(withCookies: boolean): Promise<HeadersInit> {
  const incoming = await headers();
  const result: Record<string, string> = { Accept: "application/json" };
  // Let Django build public URLs (canonical links, sitemap) for the host the visitor used.
  const host = incoming.get("x-forwarded-host") ?? incoming.get("host");
  if (host) result["X-Forwarded-Host"] = host;
  result["X-Forwarded-Proto"] = incoming.get("x-forwarded-proto") ?? "http";
  if (withCookies) {
    const cookieHeader = (await cookies()).toString();
    if (cookieHeader) result.Cookie = cookieHeader;
  }
  return result;
}

/** GET a backend endpoint from a server component. Pass `withCookies` for user-specific data. */
export async function apiGet<T>(path: string, { withCookies = false } = {}): Promise<T> {
  const response = await fetch(`${BACKEND_URL}${path}`, {
    cache: "no-store",
    headers: await forwardedHeaders(withCookies),
  });
  if (!response.ok) throw await errorFromResponse(response);
  return response.json() as Promise<T>;
}

/** Like apiGet, but returns null for a 404 (so pages can call notFound()). */
export async function apiGetOrNull<T>(path: string, options = {}): Promise<T | null> {
  try {
    return await apiGet<T>(path, options);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const auth = await apiGet<AuthState>("/api/v1/auth/me/", { withCookies: true });
    return auth.user;
  } catch {
    return null;
  }
}

export function query(params: Record<string, string | string[] | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const single = Array.isArray(value) ? value[0] : value;
    if (single) search.set(key, single);
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}
