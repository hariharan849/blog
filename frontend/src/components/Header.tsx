import Link from "next/link";
import { profiles } from "@/lib/authors";
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
          {profiles.map((p) => (
            <Link key={p.username} href={`/about/${p.username}`}>
              About {p.shortName}
            </Link>
          ))}
        </nav>
        <SearchForm className="header-search" />
      </div>
    </header>
  );
}
