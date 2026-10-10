"use client";

import Link from "next/link";
import { useState } from "react";

import { apiRequest } from "@/lib/client-api";
import { formatDate } from "@/lib/format";
import type { Article } from "@/lib/types";

function relevanceClass(relevance: number) {
  if (relevance >= 75) return "bg-success";
  if (relevance >= 50) return "bg-primary";
  return "bg-secondary";
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
    <div className={`card mb-3${article.is_read ? " opacity-75" : ""}`} data-testid="article-card">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-start gap-2">
          <h3 className="card-title h5 mb-1">
            <a href={article.url} target="_blank" rel="noopener noreferrer">{article.title}</a>
          </h3>
          <span className={`badge ${relevanceClass(article.relevance)}`} title={article.relevance_reason}>
            {article.relevance}
          </span>
        </div>
        <p className="text-muted small mb-2">
          {meta.join(" · ")}
          {article.worth_deep_read && <> · <strong>worth a deep read</strong></>}
        </p>
        {article.summary && <p className="mb-2">{article.summary}</p>}
        {article.key_points.length > 0 && (
          <ul className="mb-2">
            {article.key_points.map((point) => (
              <li key={point.point}>
                {point.point}
                {point.why_interesting && <span className="text-muted"> — {point.why_interesting}</span>}
              </li>
            ))}
          </ul>
        )}
        {article.status === "failed" && <p className="text-danger small mb-2">Enrichment failed: {article.error}</p>}
        {error && <p className="text-danger small mb-2">{error}</p>}
        <div className="d-flex flex-wrap align-items-center gap-1">
          {article.tags.map((tag) => (
            <Link key={tag.slug} href={`/bytes/articles/?tag=${tag.slug}`} className="badge bg-light text-dark border text-decoration-none">
              #{tag.name}
            </Link>
          ))}
          <span className="ms-auto d-flex gap-1">
            <button type="button" className="btn btn-sm btn-outline-warning" onClick={() => toggle("is_starred")}>
              {article.is_starred ? "★ Starred" : "☆ Star"}
            </button>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => toggle("is_read")}>
              {article.is_read ? "Mark unread" : "Mark read"}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
