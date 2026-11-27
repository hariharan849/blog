/** Compact search box in the header. A plain GET form, so it works without JavaScript. */
export default function HeaderSearch() {
  return (
    <form action="/search" role="search" className="header-search">
      <label htmlFor="header-search-q" className="visually-hidden">
        Search the site
      </label>
      <svg viewBox="0 0 24 24" aria-hidden="true" className="header-search-icon">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input id="header-search-q" name="q" type="search" placeholder="Search…" autoComplete="off" />
    </form>
  );
}
