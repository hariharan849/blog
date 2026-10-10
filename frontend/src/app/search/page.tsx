import type { Metadata } from "next";
import Link from "next/link";

import { ApiError } from "@/lib/errors";
import { apiGet, query } from "@/lib/server-api";
import type { SearchMode, SearchResponse } from "@/lib/types";

export const metadata: Metadata = { title: "Search", robots: { index: false } };

const MODES: { value: SearchMode; label: string }[] = [
  { value: "hybrid", label: "Smart (hybrid)" },
  { value: "semantic", label: "By meaning" },
  { value: "keyword", label: "Exact keywords" },
];

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const params = await searchParams;
  const q = (typeof params.q === "string" ? params.q : "").trim();
  const mode = MODES.some((m) => m.value === params.mode) ? (params.mode as SearchMode) : "hybrid";
  let data: SearchResponse | null = null;
  let error = "";
  if (q) {
    try {
      data = await apiGet<SearchResponse>(`/api/v1/search/${query({ q, mode, limit: "20" })}`);
    } catch (err) {
      error = err instanceof ApiError ? err.message : "Search failed.";
    }
  }

  return (
    <>
      <h1 className="h3">{q ? <>Search results for &ldquo;{q}&rdquo;</> : "Search"}</h1>
      <form action="/search/" method="get" className="row g-2 my-3">
        <div className="col-md-7">
          <input type="search" name="q" defaultValue={q} className="form-control" aria-label="Search query"
            placeholder="Ask a question or search by keyword..." />
        </div>
        <div className="col-md-3">
          <select name="mode" defaultValue={mode} className="form-select" aria-label="Search mode">
            {MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div className="col-md-2">
          <button className="btn btn-primary w-100" type="submit">Search</button>
        </div>
      </form>
      {error && <div className="alert alert-warning">{error}</div>}
      {data && (data.results.length ? (
        <ul className="list-group">
          {data.results.map((result) => (
            <li className="list-group-item" key={result.slug}>
              <Link href={`/post/${result.slug}/`}><strong>{result.title}</strong></Link>
              {result.category && <span className="badge bg-primary ms-2">{result.category}</span>}
              <p className="mb-0">{result.snippet}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p>No results found.</p>
      ))}
    </>
  );
}
