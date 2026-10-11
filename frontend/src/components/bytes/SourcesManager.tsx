"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ApiError, apiRequest } from "@/lib/client-api";
import { formatDate } from "@/lib/format";
import type { Source } from "@/lib/types";
import { alertError, buttonPrimary, card, cn, input, label } from "@/lib/ui";

interface ImportResult {
  created: Source[];
  existing: number;
  errors: string[];
}

export default function SourcesManager({ sources }: { sources: Source[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function importSources(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    if (!(form.get("opml") as File | null)?.size) form.delete("opml");
    setBusy(true);
    setMessage("");
    setErrors([]);
    try {
      const result = await apiRequest<ImportResult>("/api/v1/bytes/sources/", "POST", { form });
      setMessage(`Added ${result.created.length} source(s); ${result.existing} already present.`);
      setErrors(result.errors);
      formElement.reset();
      router.refresh();
    } catch (err) {
      setErrors([err instanceof ApiError ? err.message : "Import failed."]);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(source: Source) {
    await apiRequest(`/api/v1/bytes/sources/${source.id}/`, "PATCH", { json: { is_active: !source.is_active } });
    router.refresh();
  }

  return (
    <section aria-labelledby="sources-heading" className="space-y-5">
      <div>
        <h2 id="sources-heading" className="font-serif text-xl font-semibold">Writers &amp; publications</h2>
        <p className="mt-1 text-sm text-zinc-500">Substack, Medium (@user, publication or tag), Towards AI and most blogs with RSS.</p>
      </div>
      <form onSubmit={importSources} className={cn(card, "space-y-4 p-5")}>
        {message && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
            {message}
          </div>
        )}
        {errors.map((error) => <div className={alertError} key={error}>{error}</div>)}
        <div>
          <label htmlFor="urls" className={label}>Add by URL</label>
          <textarea id="urls" name="urls" rows={4} className={cn(input, "font-mono text-xs")}
            placeholder={"https://name.substack.com\nhttps://medium.com/@writer\nhttps://pub.towardsai.net"} />
          <p className="mt-1.5 text-xs text-zinc-500">One profile, publication, tag or feed URL per line.</p>
        </div>
        <div>
          <label htmlFor="opml" className={label}>or import OPML</label>
          <input id="opml" name="opml" type="file" accept=".opml,.xml,text/xml"
            className={cn(input, "file:mr-3 file:rounded-full file:border-0 file:bg-zinc-100 file:px-3 file:py-1 file:text-sm dark:file:bg-zinc-800")} />
        </div>
        <button className={buttonPrimary} type="submit" disabled={busy}>{busy ? "Adding…" : "Add sources"}</button>
      </form>

      <ul className={cn(card, "divide-y divide-zinc-100 dark:divide-zinc-800")}>
        {sources.length ? (
          sources.map((source) => (
            <li key={source.id} className={cn("flex items-center gap-4 px-5 py-3.5", !source.is_active && "opacity-50")}>
              <span aria-hidden className={cn("size-2 shrink-0 rounded-full", source.last_error ? "bg-red-500" : source.is_active ? "bg-emerald-500" : "bg-zinc-400")} />
              <div className="min-w-0 flex-1">
                <a href={source.site_url || source.feed_url} target="_blank" rel="noopener noreferrer" className="block truncate font-medium hover:text-indigo-600 dark:hover:text-indigo-300">
                  {source.name}
                </a>
                <p className="text-xs text-zinc-500">
                  {source.kind_display} · {source.last_fetched_at ? `fetched ${formatDate(source.last_fetched_at, "short")}` : "never fetched"}
                </p>
                {source.last_error && <p className="mt-1 truncate text-xs text-red-600 dark:text-red-400">{source.last_error}</p>}
              </div>
              <button type="button" onClick={() => toggle(source)}
                className="rounded-full px-3 py-1 text-sm text-zinc-500 transition hover:bg-zinc-100 dark:hover:bg-zinc-800">
                {source.is_active ? "Pause" : "Resume"}
              </button>
            </li>
          ))
        ) : (
          <li className="px-5 py-8 text-center text-sm text-zinc-500">No sources yet.</li>
        )}
      </ul>
    </section>
  );
}
