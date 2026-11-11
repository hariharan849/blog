import Link from "next/link";
import { profile } from "@/lib/profile";

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <p>
          &copy; {year} {profile.name}
        </p>
        <div className="footer-links">
          {profile.links.map((l) => (
            <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer">
              {l.label}
            </a>
          ))}
          <Link href="/admin" className="footer-admin">
            Admin
          </Link>
        </div>
      </div>
    </footer>
  );
}
