"use client";

import { useActionState, useState, useTransition } from "react";
import { signIn, signOut } from "next-auth/react";
import type { Source } from "@/lib/feed";
import { addSource, removeSource, runNow, toggleSource, type ActionResult } from "./actions";

const PLACEHOLDER = {
  medium: "@username or medium.com/@username",
  substack: "name or name.substack.com (custom domains work too)",
  rss: "https://example.com/feed.xml",
} as const;

export function SignInButton() {
  return (
    <button className="button" onClick={() => signIn("github", { callbackUrl: "/admin" })}>
      Sign in with GitHub
    </button>
  );
}

export function SignOutButton() {
  return (
    <button className="button button-secondary button-small" onClick={() => signOut({ callbackUrl: "/" })}>
      Sign out
    </button>
  );
}

function Notice({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  return (
    <p className={result.ok ? "success" : "field-error"} role="status">
      {result.message}
    </p>
  );
}

export function AddSourceForm() {
  const [kind, setKind] = useState<keyof typeof PLACEHOLDER>("medium");
  const [result, action, pending] = useActionState(addSource, null);
  return (
    <form action={action} className="card admin-form">
      <div className="card-body">
        <h2>Follow an author</h2>
        <div className="admin-form-row">
          <label>
            Source
            <select name="kind" value={kind} onChange={(e) => setKind(e.target.value as keyof typeof PLACEHOLDER)}>
              <option value="medium">Medium</option>
              <option value="substack">Substack</option>
              <option value="rss">Any RSS / Atom feed</option>
            </select>
          </label>
          <label className="grow">
            Username or URL
            <input name="value" placeholder={PLACEHOLDER[kind]} required autoComplete="off" />
          </label>
          <button type="submit" className="button" disabled={pending}>
            {pending ? "Checking feed…" : "Add"}
          </button>
        </div>
        {!pending && <Notice result={result} />}
      </div>
    </form>
  );
}

export function SourceRow({ source }: { source: Source }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const run = (fn: () => Promise<ActionResult>) => start(async () => setResult(await fn()));

  return (
    <li className={`source-row${source.enabled ? "" : " is-paused"}`}>
      <div className="source-main">
        <p className="source-title">
          <span className={`badge badge-${source.kind}`}>{source.kind}</span>
          {source.site_url ? (
            <a href={source.site_url} target="_blank" rel="noopener noreferrer">
              {source.title}
            </a>
          ) : (
            source.title
          )}
          {!source.enabled && <span className="badge badge-muted">paused</span>}
        </p>
        <p className="meta small">
          {source.feed_url}
          {source.last_checked_at && <> · checked {new Date(source.last_checked_at).toLocaleString()}</>}
          {typeof source.last_new_count === "number" && <> · {source.last_new_count} new last run</>}
        </p>
        {source.last_error && <p className="field-error small">Last run failed: {source.last_error}</p>}
        <Notice result={result && !result.ok ? result : null} />
      </div>
      <div className="source-actions">
        <button
          className="button button-secondary button-small"
          disabled={pending}
          onClick={() => run(() => toggleSource(source.id, !source.enabled))}
        >
          {source.enabled ? "Pause" : "Resume"}
        </button>
        <button
          className="button button-danger button-small"
          disabled={pending}
          onClick={() => {
            if (confirm(`Stop following ${source.title}?`)) run(() => removeSource(source.id));
          }}
        >
          Remove
        </button>
      </div>
    </li>
  );
}

export function RunNowButton() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  return (
    <div className="run-now">
      <button className="button button-secondary" disabled={pending} onClick={() => start(async () => setResult(await runNow()))}>
        {pending ? "Starting…" : "Run now"}
      </button>
      <Notice result={result} />
    </div>
  );
}
