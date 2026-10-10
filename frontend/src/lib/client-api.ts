import { errorFromResponse } from "./errors";

export { ApiError } from "./errors";

const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function readCookie(name: string): string | null {
  const match = document.cookie.split("; ").find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

async function csrfToken(): Promise<string> {
  let token = readCookie("csrftoken");
  if (!token) {
    await fetch("/api/v1/auth/csrf/", { credentials: "same-origin" });
    token = readCookie("csrftoken");
  }
  return token ?? "";
}

type Body = { json?: unknown; form?: FormData };

/** Same-origin request from the browser; adds the Django CSRF header for unsafe methods. */
export async function apiRequest<T>(path: string, method = "GET", body: Body = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (UNSAFE.has(method)) headers["X-CSRFToken"] = await csrfToken();
  let payload: BodyInit | undefined;
  if (body.form) {
    payload = body.form; // the browser sets the multipart boundary
  } else if (body.json !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body.json);
  }
  const response = await fetch(path, { method, headers, body: payload, credentials: "same-origin" });
  if (!response.ok) throw await errorFromResponse(response);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
