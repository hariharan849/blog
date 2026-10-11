"use client";

import Link from "next/link";
import { useState } from "react";

import { apiRequest } from "@/lib/client-api";
import { formatDate } from "@/lib/format";
import type { Article } from "@/lib/types";
import { card, cn } from "@/lib/ui";

function relevanceColor(relevance: number) {
  if (relevance >= 75) return "from-emerald-500 to-teal-500";
  if (relevance >= 50) return "from-indigo-500 to-violet-500";
  return "from-zinc-400 to-zinc-500";
}

export default function ArticleCard({ article: initial }: { article: Article }) {
  const [article, setArticle] = useState(initial);
  const [error, setError] = useState("");

  async function toggle(field: "is_read" | "is_starred") {
    const value = !article[field];
    setArticle({ ...article, [field]: value }); // optimistic
    setError("");
    try {
      await apiRequest(`/api/v1/bytes/articles/${article.id}/`, "PATCH", { json: { [field]: value } });
    } catch {
      setArticle({ ...article, [field]: !value });
      setError("Could not save. Please try again.");
    }
  }

  const meta = [
    article.source.name,
    article.author,
    formatDate(article.published_at, "short"),
    `${article.reading_minutes} min`,
    article.difficulty_display,
    article.content_type,
  ].filter(Boolean);

  return (
    <article className={cn(card, "animate-fade-in p-5 transition", article.is_read && "opacity-60")} data-testid="article-card">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-zinc-500">{meta.join(" · ")}</p>
          <h3 className="mt-1 font-serif text-lg font-semibold leading-snug">
            <a href={article.url} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600 dark:hover:text-indigo-300">
              {article.title}
            </a>
            {article.worth_deep_read && (
              <span className="ml-2 rounded-full bg-amber-500/10 px-2 py-0.5 align-middle font-sans text-xs font-medium text-amber-700 dark:text-amber-300">
                worth a deep read
              </span>
            )}
          </h3>
        </div>
        <div className="w-20 shrink-0 text-right" title={article.relevance_reason}>
          <p className="text-lg font-semibold tabular-nums">{article.relevance}</p>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800" aria-label={`Relevance ${article.relevance} of 100`} role="img">
            <div className={cn("h-full rounded-full bg-gradient-to-r", relevanceColor(article.relevance))} style={{ width: `${article.relevance}%` }} />
          </div>
        </div>
      </div>
      {article.summary && <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">{article.summary}</p>}
      {article.key_points.length > 0 && (
        <ul className="mt-3 space-y-1.5 text-sm">
          {article.key_points.map((point) => (
            <li key={point.point} className="flex gap-2">
              <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-indigo-500" />
              <span>
                {point.point}
                {point.why_interesting && <span className="text-zinc-500"> — {point.why_interesting}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {article.status === "failed" && <p className="mt-3 text-sm text-red-600 dark:text-red-400">Enrichment failed: {article.error}</p>}
      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {article.tags.map((tag) => (
          <Link key={tag.slug} href={`/bytes/articles/?tag=${tag.slug}`} className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700">
            #{tag.name}
          </Link>
        ))}
        <span className="ml-auto flex gap-1">
          <button type="button" aria-pressed={article.is_starred} onClick={() => toggle("is_starred")}
            className={cn("rounded-full px-3 py-1 text-sm transition", article.is_starred ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800")}>
            {article.is_starred ? "★ Starred" : "☆ Star"}
          </button>
          <button type="button" aria-pressed={article.is_read} onClick={() => toggle("is_read")}
            className="rounded-full px-3 py-1 text-sm text-zinc-500 transition hover:bg-zinc-100 dark:hover:bg-zinc-800">
            {article.is_read ? "Mark unread" : "Mark read"}
          </button>
        </span>
      </div>
    </article>
  );
}
