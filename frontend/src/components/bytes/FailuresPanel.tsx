"use client";

import { useState } from "react";

import { apiRequest } from "@/lib/client-api";
import { formatDate } from "@/lib/format";
import type { PipelineFailure } from "@/lib/types";
import { card, cn } from "@/lib/ui";

const TASK_LABELS: Record<string, string> = {
  "learning.enrich": "Enrich",
  "learning.process_article": "Index / enrich",
  "learning.fetch_source": "Fetch feed",
};

export default function FailuresPanel({ failures: initial, total }: { failures: PipelineFailure[]; total: number }) {
  const [failures, setFailures] = useState(initial);
  const [remaining, setRemaining] = useState(total);

  async function resolve(failure: PipelineFailure) {
    await apiRequest(`/api/v1/bytes/failures/${failure.id}/`, "PATCH", { json: { resolved: true } });
    setFailures(failures.filter((item) => item.id !== failure.id));
    setRemaining(remaining - 1);
  }

  return (
    <section aria-labelledby="health-heading" className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 id="health-heading" className="font-serif text-xl font-semibold">Pipeline health</h2>
        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium",
          remaining ? "bg-red-500/10 text-red-700 dark:text-red-300" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300")}>
          {remaining ? `${remaining} open ${remaining === 1 ? "failure" : "failures"}` : "All good"}
        </span>
      </div>
      <p className="text-sm text-zinc-500">
        Steps that still failed after retrying. Export them with <code className="text-xs">manage.py export_failures</code> to build an evaluation set.
      </p>
      {failures.length > 0 && (
        <ul className={cn(card, "divide-y divide-zinc-100 dark:divide-zinc-800")}>
          {failures.map((failure) => (
            <li key={failure.id} className="flex items-start gap-4 px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {TASK_LABELS[failure.task_name] ?? failure.task_name}
                  <span className="font-normal text-zinc-500"> · {failure.article?.title ?? failure.source?.name ?? "—"}</span>
                </p>
                <p className="mt-0.5 truncate font-mono text-xs text-red-600 dark:text-red-400" title={failure.error}>
                  {failure.error_type && `${failure.error_type}: `}{failure.error}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {formatDate(failure.created_at, "short")} · {failure.attempts} {failure.attempts === 1 ? "attempt" : "attempts"}
                </p>
              </div>
              <button type="button" onClick={() => resolve(failure)}
                className="rounded-full px-3 py-1 text-sm text-zinc-500 transition hover:bg-zinc-100 dark:hover:bg-zinc-800">
                Resolve
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
