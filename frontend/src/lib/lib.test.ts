import { describe, expect, it, vi } from "vitest";

import { ApiError, apiRequest } from "./client-api";
import { formatDate, jsonLd, truncateWords } from "./format";
import { safeNext } from "./safe-next";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("apiRequest", () => {
  it("sends the CSRF token on unsafe requests, fetching it first when missing", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/v1/auth/csrf/") {
        document.cookie = "csrftoken=abc123; path=/";
        return jsonResponse({ ok: true });
      }
      return jsonResponse({ id: 1 }, 201);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest("/api/v1/bytes/interests/", "POST", { json: { name: "RAG" } })).resolves.toEqual({ id: 1 });
    const [, init] = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    expect(init.headers).toMatchObject({ "X-CSRFToken": "abc123", "Content-Type": "application/json" });
    expect(init.body).toBe(JSON.stringify({ name: "RAG" }));
  });

  it("does not send a CSRF token on GET and raises ApiError with the server message", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ error: "Nope", fields: { q: ["Required"] } }, 400));
    vi.stubGlobal("fetch", fetchMock);
    const error = await apiRequest("/api/v1/search/").catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ message: "Nope", status: 400, fields: { q: ["Required"] } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("helpers", () => {
  it("only allows relative next URLs", () => {
    expect(safeNext("/bytes/")).toBe("/bytes/");
    expect(safeNext("//evil.test")).toBe("/");
    expect(safeNext("https://evil.test")).toBe("/");
    expect(safeNext(undefined, "/home")).toBe("/home");
  });

  it("escapes JSON-LD so it cannot close the script tag", () => {
    expect(jsonLd({ a: "</script><script>" })).not.toContain("</script>");
  });

  it("formats dates in UTC and truncates text", () => {
    expect(formatDate("2026-03-05")).toBe("March 5, 2026");
    expect(formatDate("2026-03-05T23:30:00Z", "short")).toBe("Mar 5");
    expect(truncateWords("one two three", 2)).toBe("one two…");
  });
});
