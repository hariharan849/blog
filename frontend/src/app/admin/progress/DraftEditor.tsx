"use client";

import { useState, useTransition } from "react";
import type { WeeklyDraft } from "@/lib/weekly";
import { discardDraft, generateDraft, publishDraft, saveDraftEdits, type DraftResult } from "./actions";

export default function DraftEditor({ initial, canPublish }: { initial: WeeklyDraft | null; canPublish: boolean }) {
  const [draft, setDraft] = useState(initial);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [result, setResult] = useState<DraftResult | null>(null);
  const [pending, start] = useTransition();

  const load = (d: WeeklyDraft | null | undefined) => {
    setDraft(d ?? null);
    setTitle(d?.title ?? "");
    setSummary(d?.summary ?? "");
    setBody(d?.body ?? "");
  };
  const run = (p: () => Promise<DraftResult>, reload = true) =>
    start(async () => {
      const res = await p();
      setResult(res);
      if (res.ok && reload && res.draft !== undefined) load(res.draft);
    });

  if (!draft) {
    return (
      <div className="card admin-form">
        <div className="card-body">
          <h2>No draft right now</h2>
          <p className="muted small">
            The next one is written automatically on Sunday evening, or you can draft this week now.
          </p>
          <button type="button" className="button" disabled={pending} onClick={() => run(generateDraft)}>
            {pending ? "Drafting…" : "Draft this week now"}
          </button>
          {result && <p className={result.ok ? "success" : "field-error"}>{result.message}</p>}
        </div>
      </div>
    );
  }

  const edits = { title, summary, body };
  return (
    <div className="editor-item">
      <p className="meta small">Draft for the week ending {draft.weekEnding}</p>
      <label>
        Title
        <input value={title} maxLength={140} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label>
        One-line summary
        <input value={summary} maxLength={300} onChange={(e) => setSummary(e.target.value)} />
      </label>
      <label>
        Update (Markdown)
        <textarea
          rows={18}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.9rem" }}
        />
      </label>
      <p className="muted small">
        Lines in _italics_ are prompts for you to replace. Links like [title](/blog/slug) work.
      </p>
      <div className="editor-actions">
        <button
          type="button"
          className="button"
          disabled={pending || !canPublish}
          onClick={() => run(() => publishDraft(edits, draft))}
        >
          Publish
        </button>
        <button
          type="button"
          className="button button-secondary"
          disabled={pending}
          onClick={() => run(() => saveDraftEdits(edits, draft), false)}
        >
          Save draft
        </button>
        <button type="button" className="button button-secondary" disabled={pending} onClick={() => run(generateDraft)}>
          Rebuild from activity
        </button>
        <button type="button" className="button button-danger" disabled={pending} onClick={() => run(discardDraft)}>
          Discard
        </button>
      </div>
      {result && <p className={result.ok ? "success" : "field-error"}>{result.message}</p>}
    </div>
  );
}
