"use client";

import Link from "next/link";
import { useState } from "react";

import { ApiError, apiRequest } from "@/lib/client-api";
import { formatDate } from "@/lib/format";
import type { Comment, User } from "@/lib/types";

export default function CommentSection({ slug, initialComments, user }: { slug: string; initialComments: Comment[]; user: User | null }) {
  const [comments, setComments] = useState(initialComments);
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSending(true);
    setError("");
    try {
      const comment = await apiRequest<Comment>(`/api/v1/posts/${slug}/comments/`, "POST", { json: { content } });
      setComments([comment, ...comments]);
      setContent("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not post your comment.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="mt-5">
      <h3>Comments</h3>
      {comments.length ? (
        <ul className="list-group">
          {comments.map((comment) => (
            <li className="list-group-item" key={comment.id}>
              <strong>{comment.name}</strong> <span className="text-muted small">on {formatDate(comment.created_at)}</span>
              <p className="mb-0">{comment.content}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p>No comments yet. Be the first to comment!</p>
      )}
      {user ? (
        <form onSubmit={submit} className="mt-3">
          <label htmlFor="comment" className="form-label">Add a comment as {user.name}</label>
          <textarea id="comment" className="form-control mb-2" rows={3} value={content} required
            onChange={(event) => setContent(event.target.value)} />
          {error && <div className="alert alert-danger py-2">{error}</div>}
          <button type="submit" className="btn btn-primary" disabled={sending || !content.trim()}>
            {sending ? "Posting…" : "Submit comment"}
          </button>
        </form>
      ) : (
        <p className="mt-3">
          <Link href={`/login/?next=${encodeURIComponent(`/post/${slug}/`)}`}>Log in</Link> to post a comment.
        </p>
      )}
    </section>
  );
}
