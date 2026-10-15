"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";

import { ApiError, apiRequest } from "@/lib/client-api";
import { formatDate } from "@/lib/format";
import type { AskResult, KBScope, KBSource } from "@/lib/types";
import { alertError, alertInfo, buttonPrimary, cn, input } from "@/lib/ui";

const SCOPES: { value: KBScope; label: string }[] = [
  { value: "posts", label: "Blog" },
  { value: "newsletters", label: "Newsletters" },
  { value: "all", label: "Both" },
];

function SourceLink({ source, className, children }: { source: KBSource; className?: string; children: React.ReactNode }) {
  return source.kind === "post" ? (
    <Link href={source.url} className={className}>{children}</Link>
  ) : (
    <a href={source.url} target="_blank" rel="noopener noreferrer" className={className}>{children}</a>
  );
}

/** Renders "text [1] more [2]" with the markers as links to the numbered sources below. */
function AnswerText({ text, sources }: { text: string; sources: KBSource[] }) {
  return (
    <>
      {text.split(/\n{2,}/).map((paragraph, index) => (
        <p key={index} className="leading-relaxed">
          {paragraph.split(/(\[\d+\])/).map((part, i) => {
            const match = /^\[(\d+)\]$/.exec(part);
            const source = match && sources.find((s) => s.n === Number(match[1]));
            if (!source) return <Fragment key={i}>{part}</Fragment>;
            return (
              <a
                key={i}
                href={`#source-${source.n}`}
                title={source.title}
                aria-label={`Source ${source.n}: ${source.title}`}
                className="mx-0.5 inline-grid size-5 -translate-y-0.5 place-items-center rounded-full bg-indigo-500/15 align-middle text-[11px] font-semibold text-indigo-700 no-underline hover:bg-indigo-500/25 dark:text-indigo-300"
              >
                {source.n}
              </a>
            );
          })}
        </p>
      ))}
    </>
  );
}

export default function AskPanel({ initialQuestion, canUseNewsletters }: { initialQuestion: string; canUseNewsletters: boolean }) {
  const [question, setQuestion] = useState(initialQuestion);
  const [scope, setScope] = useState<KBScope>(canUseNewsletters ? "all" : "posts");
  const [result, setResult] = useState<AskResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const asked = useRef(false);

  const submit = useCallback(async (text: string, selectedScope: KBScope) => {
    if (!text.trim()) return;
    setBusy(true);
    setError("");
    window.history.replaceState(null, "", `/ask/?q=${encodeURIComponent(text.trim())}`);
    try {
      setResult(await apiRequest<AskResult>("/api/v1/kb/ask/", "POST", { json: { question: text, scope: selectedScope } }));
    } catch (err) {
      setResult(null);
      setError(err instanceof ApiError
        ? err.status === 429 ? "You've asked a lot of questions recently. Please try again later." : err.message
        : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    // Answer the question from the URL (e.g. coming from the ⌘K palette) once, on first load.
    if (initialQuestion && !asked.current) {
      // Mark as asked only when the timer actually fires: StrictMode runs this effect twice and
      // cancels the first timer in between.
      const timer = window.setTimeout(() => {
        asked.current = true;
        submit(initialQuestion, canUseNewsletters ? "all" : "posts");
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [initialQuestion, canUseNewsletters, submit]);

  const cited = new Set(result?.citations.map((c) => c.n));

  return (
    <div className="space-y-8">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit(question, scope);
        }}
        className="space-y-3"
      >
        <div className="flex gap-2">
          <label htmlFor="question" className="sr-only">Your question</label>
          <input id="question" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={500}
            placeholder="e.g. How does self-attention work?" className={cn(input, "py-3 text-base")} />
          <button type="submit" className={buttonPrimary} disabled={busy || !question.trim()}>{busy ? "Thinking…" : "Ask"}</button>
        </div>
        {canUseNewsletters && (
          <div role="group" aria-label="Search in" className="flex gap-2 text-sm">
            {SCOPES.map((option) => (
              <button key={option.value} type="button" aria-pressed={scope === option.value} onClick={() => setScope(option.value)}
                className={cn("rounded-full border px-3 py-1 transition",
                  scope === option.value ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900"
                    : "border-zinc-200 text-zinc-600 hover:border-zinc-300 dark:border-zinc-800 dark:text-zinc-400")}>
                {option.label}
              </button>
            ))}
          </div>
        )}
      </form>

      {error && <div className={alertError} role="alert">{error}</div>}

      {busy && !result && (
        <div className="space-y-3" aria-label="Loading answer">
          {[0, 1, 2].map((i) => <div key={i} className="h-4 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" style={{ width: `${90 - i * 15}%` }} />)}
        </div>
      )}

      {result && (
        <section aria-live="polite" className={cn("space-y-8", busy && "opacity-60")}>
          {result.answer ? (
            <div className="rounded-3xl border border-zinc-200 bg-gradient-to-b from-indigo-50/60 to-white p-6 text-zinc-800 dark:border-zinc-800 dark:from-indigo-950/30 dark:to-zinc-950 dark:text-zinc-200">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Answer</p>
              <div className="space-y-3"><AnswerText text={result.answer} sources={result.sources} /></div>
            </div>
          ) : result.sources.length ? (
            <div className={alertInfo}>
              {result.error ?? "AI answers aren't enabled on this site yet, so here are the most relevant passages."}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-zinc-500 dark:border-zinc-700">
              Nothing in the knowledge base matches that question yet.
            </p>
          )}

          {result.sources.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Sources</h2>
              <ol className="mt-3 space-y-3">
                {result.sources.map((source) => (
                  <li key={source.id} id={`source-${source.n}`}
                    className={cn("scroll-mt-24 rounded-2xl border p-4 transition target:ring-2 target:ring-indigo-500",
                      cited.has(source.n) || !result.answer ? "border-zinc-200 dark:border-zinc-800" : "border-zinc-100 opacity-70 dark:border-zinc-900")}>
                    <div className="flex items-start gap-3">
                      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-zinc-100 text-xs font-semibold dark:bg-zinc-800">{source.n}</span>
                      <div className="min-w-0 flex-1">
                        <SourceLink source={source} className="font-medium hover:text-indigo-600 dark:hover:text-indigo-300">
                          {source.title}{source.heading && <span className="text-zinc-500"> › {source.heading}</span>}
                        </SourceLink>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          {source.kind === "post" ? "Blog post" : "Newsletter"} · {source.source}
                          {source.published_at && <> · {formatDate(source.published_at, "short")}</>}
                        </p>
                        <p className="mt-2 line-clamp-3 text-sm text-zinc-600 dark:text-zinc-400">
                          {result.citations.find((c) => c.n === source.n)?.quote || source.snippet}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {result.model && <p className="text-xs text-zinc-500">Answered by {result.model} · check sources before relying on it.</p>}
        </section>
      )}
    </div>
  );
}
