import Link from "next/link";
import { profile } from "@/lib/profile";
import NavLinks from "./NavLinks";
import HeaderSearch from "./HeaderSearch";

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2);
}

export default function Header() {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link href="/" className="brand" aria-label={`${profile.name}, home`}>
          <span className="brand-mark" aria-hidden="true">
            {initials(profile.name)}
          </span>
          <span className="brand-text">
            <span className="brand-name">{profile.name}</span>
            <span className="brand-tag">AI engineering notebook</span>
          </span>
        </Link>
        <HeaderSearch />
        <Link href="/daily#subscribe" className="button button-small header-cta">
          Subscribe
        </Link>
        <NavLinks />
      </div>
    </header>
  );
}
