export default function SearchForm({
  defaultValue = "",
  className = "",
}: {
  defaultValue?: string;
  className?: string;
}) {
  return (
    <form action="/search" method="get" role="search" className={`search-form ${className}`}>
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder="Search posts…"
        aria-label="Search posts"
        required
      />
      <button type="submit">Search</button>
    </form>
  );
}
