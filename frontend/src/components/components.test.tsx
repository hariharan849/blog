import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import CommentSection from "./CommentSection";
import ArticleCard from "./bytes/ArticleCard";

import type { Article } from "@/lib/types";

const article: Article = {
  id: 7, title: "Reliable agents", url: "https://x.test/a", source: { id: 1, name: "Agentic" }, author: "Ada",
  published_at: "2026-10-01T10:00:00Z", reading_minutes: 4, status: "enriched", error: "", summary: "Agents need evals.",
  key_points: [{ point: "Log tool calls", why_interesting: "Debuggable" }], tags: [{ name: "agents", slug: "agents" }],
  difficulty: "intermediate", difficulty_display: "Intermediate", content_type: "tutorial", relevance: 82,
  relevance_reason: "Core interest", worth_deep_read: true, is_read: false, is_starred: false,
};

function ok(body: unknown = {}, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("ArticleCard", () => {
  it("renders insights and toggles star with a PATCH", async () => {
    document.cookie = "csrftoken=t; path=/";
    const fetchMock = vi.fn(async () => ok({}));
    vi.stubGlobal("fetch", fetchMock);
    render(<ArticleCard article={article} />);
    expect(screen.getByText("Log tool calls")).toBeInTheDocument();
    expect(screen.getByText("#agents")).toHaveAttribute("href", "/bytes/articles/?tag=agents");

    fireEvent.click(screen.getByRole("button", { name: "☆ Star" }));
    expect(screen.getByRole("button", { name: "★ Starred" })).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/v1/bytes/articles/7/");
    expect(init).toMatchObject({ method: "PATCH", body: JSON.stringify({ is_starred: true }) });
  });

  it("rolls back when saving fails", async () => {
    document.cookie = "csrftoken=t; path=/";
    vi.stubGlobal("fetch", vi.fn(async () => ok({ error: "boom" }, 500)));
    render(<ArticleCard article={article} />);
    fireEvent.click(screen.getByRole("button", { name: "Mark read" }));
    expect(await screen.findByText("Could not save. Please try again.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark read" })).toBeInTheDocument();
  });
});

describe("CommentSection", () => {
  it("asks anonymous visitors to log in", () => {
    render(<CommentSection slug="hello" initialComments={[]} user={null} />);
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login/?next=%2Fpost%2Fhello%2F");
  });

  it("posts a comment and shows it", async () => {
    document.cookie = "csrftoken=t; path=/";
    vi.stubGlobal("fetch", vi.fn(async () => ok({ id: 1, name: "ann", content: "Great post", created_at: "2026-10-01T00:00:00Z" }, 201)));
    const user = { username: "ann", email: "", name: "ann", is_staff: false, is_superuser: false };
    render(<CommentSection slug="hello" initialComments={[]} user={user} />);
    fireEvent.change(screen.getByLabelText(/add a comment/i), { target: { value: "Great post" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit comment" }));
    expect(await screen.findByText("Great post")).toBeInTheDocument();
  });
});
