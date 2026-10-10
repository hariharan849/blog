"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ApiError, apiRequest } from "@/lib/client-api";
import { formatDate } from "@/lib/format";
import type { Source } from "@/lib/types";

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
    <>
      <h2 className="h4">Writers &amp; publications you follow</h2>
      <form onSubmit={importSources} className="card card-body mb-3">
        {message && <div className="alert alert-success py-2">{message}</div>}
        {errors.map((error) => <div className="alert alert-danger py-2" key={error}>{error}</div>)}
        <label htmlFor="urls" className="form-label">Add by URL</label>
        <textarea id="urls" name="urls" rows={4} className="form-control"
          placeholder={"https://name.substack.com\nhttps://medium.com/@writer\nhttps://pub.towardsai.net"} />
        <div className="form-text mb-2">
          One profile, publication, tag or feed URL per line. Substack, Medium (@user, publication or tag), Towards AI and most blogs work.
        </div>
        <label htmlFor="opml" className="form-label">or import OPML</label>
        <input id="opml" name="opml" type="file" accept=".opml,.xml,text/xml" className="form-control" />
        <button className="btn btn-primary mt-3" type="submit" disabled={busy}>{busy ? "Adding…" : "Add sources"}</button>
      </form>
      <table className="table table-sm align-middle">
        <thead>
          <tr><th>Source</th><th>Kind</th><th>Last fetch</th><th /></tr>
        </thead>
        <tbody>
          {sources.length ? (
            sources.map((source) => (
              <tr key={source.id} className={source.is_active ? "" : "text-muted"}>
                <td>
                  <a href={source.site_url || source.feed_url} target="_blank" rel="noopener noreferrer">{source.name}</a>
                  {source.last_error && <div className="text-danger small">{source.last_error.slice(0, 160)}</div>}
                </td>
                <td>{source.kind_display}</td>
                <td className="small">{source.last_fetched_at ? formatDate(source.last_fetched_at, "short") : "never"}</td>
                <td>
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => toggle(source)}>
                    {source.is_active ? "Pause" : "Resume"}
                  </button>
                </td>
              </tr>
            ))
          ) : (
            <tr><td colSpan={4} className="text-muted">No sources yet.</td></tr>
          )}
        </tbody>
      </table>
    </>
  );
}
