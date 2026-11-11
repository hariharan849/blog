import Link from "next/link";
import SearchForm from "./SearchForm";

export default function Header() {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link href="/" className="brand">
          PyChanter
        </Link>
        <nav className="nav" aria-label="Main">
          <Link href="/">Home</Link>
          <Link href="/about">About</Link>
        </nav>
        <SearchForm className="header-search" />
      </div>
    </header>
  );
}
