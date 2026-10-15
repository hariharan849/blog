import { act, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { describe, expect, it, vi } from "vitest";

import AskPanel from "./AskPanel";

import type { AskResult } from "@/lib/types";

const result: AskResult = {
  question: "What is attention?",
  answer: "Attention lets tokens look at each other [1]. Heads run in parallel [2].",
  citations: [{ n: 1, quote: "Self-attention lets every token look at every other token.", source_id: "post:1" }],
  sources: [
    { n: 1, id: "post:1", kind: "post", title: "Understanding Transformers", url: "/post/understanding-transformers/", heading: "Attention",
      text: "…", snippet: "Self-attention…", source: "admin", published_at: "2026-10-01T00:00:00Z", score: 1, matched_by: ["keyword"] },
    { n: 2, id: "newsletter:9", kind: "newsletter", title: "Agent memory", url: "https://n.test/agent-memory", heading: "",
      text: "…", snippet: "Heads run…", source: "Agentic", published_at: null, score: 0.5, matched_by: ["semantic"] },
  ],
  model: "claude-opus-5-5",
  mode: "answer",
  scope: "all",
};

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("AskPanel", () => {
  it("asks the question from the URL and links citations to sources", async () => {
    document.cookie = "csrftoken=t; path=/";
    const fetchMock = vi.fn(async () => respond(result));
    vi.stubGlobal("fetch", fetchMock);
    // StrictMode runs effects twice in development; the question must still be sent exactly once.
    render(<StrictMode><AskPanel initialQuestion="What is attention?" canUseNewsletters /></StrictMode>);

    expect(await screen.findByText("Answer")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/v1/kb/ask/");
    expect(JSON.parse(init.body as string)).toEqual({ question: "What is attention?", scope: "all" });

    expect(screen.getByRole("link", { name: "Source 1: Understanding Transformers" })).toHaveAttribute("href", "#source-1");
    expect(screen.getByText("Understanding Transformers").closest("a")).toHaveAttribute("href", "/post/understanding-transformers/");
    expect(screen.getByRole("link", { name: "Agent memory" })).toHaveAttribute("target", "_blank");
    expect(screen.getByText("Self-attention lets every token look at every other token.")).toBeInTheDocument();
  });

  it("shows passages when AI answers are off, and hides the scope picker for visitors", async () => {
    document.cookie = "csrftoken=t; path=/";
    vi.stubGlobal("fetch", vi.fn(async () => respond({ ...result, answer: null, citations: [], model: null, mode: "passages", scope: "posts" })));
    render(<AskPanel initialQuestion="" canUseNewsletters={false} />);
    expect(screen.queryByRole("group", { name: "Search in" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Your question"), { target: { value: "attention" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Ask" })));
    expect(await screen.findByText(/most relevant passages/)).toBeInTheDocument();
  });

  it("explains rate limits", async () => {
    document.cookie = "csrftoken=t; path=/";
    vi.stubGlobal("fetch", vi.fn(async () => respond({ error: "Request was throttled." }, 429)));
    render(<AskPanel initialQuestion="x?" canUseNewsletters={false} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("asked a lot of questions");
  });
});
