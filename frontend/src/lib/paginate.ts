/** Splits a list into numbered pages. `pageParam` is the raw ?page= value; bad or out-of-range values are clamped. */
export function paginate<T>(items: T[], pageParam: string | string[] | undefined, perPage: number) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const raw = Number.parseInt(Array.isArray(pageParam) ? pageParam[0] : (pageParam ?? "1"), 10);
  const page = Math.min(totalPages, Math.max(1, Number.isFinite(raw) ? raw : 1));
  const start = (page - 1) * perPage;
  return {
    items: items.slice(start, start + perPage),
    pager: { page, totalPages, total, from: total ? start + 1 : 0, to: Math.min(total, start + perPage) },
  };
}

/** Adds ?page=N to a path that may already have a query string; page 1 has no parameter. */
export function withPage(base: string, page: number): string {
  const [path, query = ""] = base.split("?");
  const q = new URLSearchParams(query);
  q.delete("page");
  if (page > 1) q.set("page", String(page));
  const s = q.toString();
  return `${path}${s ? `?${s}` : ""}`;
}
