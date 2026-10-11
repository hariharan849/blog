"use client";

import Link from "next/link";
import { useState } from "react";

import { ApiError, apiRequest } from "@/lib/client-api";
import { formatDate } from "@/lib/format";
import type { Comment, User } from "@/lib/types";
import { alertError, buttonPrimary, input } from "@/lib/ui";

function Avatar({ name }: { name: string }) {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-zinc-200 text-sm font-semibold uppercase text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
      {name.slice(0, 1)}
    </span>
  );
}

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
    <section aria-labelledby="comments-heading">
      <h2 id="comments-heading" className="font-serif text-2xl font-semibold tracking-tight">
        Discussion <span className="text-base font-normal text-zinc-500 dark:text-zinc-400">({comments.length})</span>
      </h2>

      {user ? (
        <form onSubmit={submit} className="mt-6 flex gap-3">
          <Avatar name={user.name} />
          <div className="flex-1 space-y-3">
            <label htmlFor="comment" className="sr-only">Add a comment as {user.name}</label>
            <textarea
              id="comment"
              className={input}
              rows={3}
              value={content}
              required
              placeholder={`Share your thoughts, ${user.name}…`}
              onChange={(event) => setContent(event.target.value)}
            />
            {error && <div className={alertError}>{error}</div>}
            <button type="submit" className={buttonPrimary} disabled={sending || !content.trim()}>
              {sending ? "Posting…" : "Submit comment"}
            </button>
          </div>
        </form>
      ) : (
        <p className="mt-6 rounded-2xl border border-dashed border-zinc-300 p-5 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
          <Link className="font-medium text-indigo-600 dark:text-indigo-400" href={`/login/?next=${encodeURIComponent(`/post/${slug}/`)}`}>
            Log in
          </Link>{" "}
          to join the discussion.
        </p>
      )}

      {comments.length ? (
        <ul className="mt-8 space-y-6">
          {comments.map((comment) => (
            <li key={comment.id} className="flex animate-fade-in gap-3">
              <Avatar name={comment.name} />
              <div>
                <p className="text-sm">
                  <span className="font-medium">{comment.name}</span>{" "}
                  <span className="text-zinc-500 dark:text-zinc-400">· {formatDate(comment.created_at)}</span>
                </p>
                <p className="mt-1 whitespace-pre-line text-zinc-700 dark:text-zinc-300">{comment.content}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-sm text-zinc-500">No comments yet. Be the first to share a thought!</p>
      )}
    </section>
  );
}
