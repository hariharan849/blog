import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import CommandPalette from "./CommandPalette";
import PostExplorer from "./PostExplorer";

import type { Category, PostSummary } from "@/lib/types";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/",
}));

function post(slug: string, blog: "hariharan" | "rajan", category: string | null): PostSummary {
  return {
    title: slug.replace(/-/g, " "), slug, url: `http://x/post/${slug}/`, blog, author: blog, summary: `About ${slug}`,
    category: category && category.toUpperCase(), category_slug: category, tags: [], image: null,
    published_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z", reading_minutes: 3,
  };
}

const posts = [post("transformers", "hariharan", "dl"), post("rag", "hariharan", "ml"), post("features", "rajan", "ml")];
const categories: Category[] = [
  { name: "Deep Learning", slug: "dl", post_count: 1 },
  { name: "Machine Learning", slug: "ml", post_count: 2 },
];

describe("PostExplorer", () => {
  beforeEach(() => window.history.replaceState(null, "", "/"));

  it("shows a featured post, then filters by topic and author instantly with the URL in sync", () => {
    render(<PostExplorer posts={posts} categories={categories} initialBlog="all" initialTopic="" />);
    expect(screen.getByText("Featured")).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(3);

    fireEvent.click(screen.getByRole("button", { name: /Machine Learning/ }));
    expect(screen.queryByText("Featured")).not.toBeInTheDocument();
    expect(screen.getAllByRole("article").map((a) => within(a).getByRole("link").textContent)).toEqual(["rag", "features"]);
    expect(window.location.search).toBe("?topic=ml");

    fireEvent.click(screen.getByRole("button", { name: "Rajan" }));
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(window.location.search).toBe("?blog=rajan&topic=ml");
    expect(screen.getByRole("button", { name: /Deep Learning/ })).toBeDisabled(); // Rajan has no DL posts

    fireEvent.click(screen.getByRole("button", { name: "All topics" }));
    fireEvent.click(screen.getByRole("button", { name: "Everyone" }));
    expect(window.location.search).toBe("");
    expect(screen.getByText("Featured")).toBeInTheDocument();
  });

  it("honours the initial filters from the URL", () => {
    render(<PostExplorer posts={posts} categories={categories} initialBlog="hariharan" initialTopic="dl" />);
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Hariharan" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("CommandPalette", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    push.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it("opens with Ctrl+K, searches as you type and opens the chosen post with Enter", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ results: [{ ...posts[0], snippet: "Self-attention…", matched_by: ["semantic"], score: 1, passages: [] }] })),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<CommandPalette user={null} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const input = screen.getByRole("combobox");
    expect(input).toHaveFocus();
    fireEvent.change(input, { target: { value: "attention" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/search/?q=attention&mode=hybrid&limit=6", expect.anything());
    expect(screen.getByRole("option", { name: /transformers/ })).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(screen.getByRole("option", { name: /Ask AI: “attention”/ })).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(screen.getByRole("option", { name: /See all results/ })).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(push).toHaveBeenCalledWith("/post/transformers/");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows role-specific actions and closes with Escape", () => {
    render(<CommandPalette user={{ username: "a", email: "", name: "a", is_staff: true, is_superuser: true }} />);
    fireEvent.keyDown(window, { key: "/" });
    expect(screen.getByRole("option", { name: /Open Daily Bytes/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Write a new post/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Sign in/ })).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
