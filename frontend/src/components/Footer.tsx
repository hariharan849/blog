import Link from "next/link";
import { profile } from "@/lib/profile";
import { projectCategories } from "@/lib/projects";

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-about">
          <p className="footer-brand">{profile.name}</p>
          <p className="footer-text">{profile.role}</p>
          <p className="footer-text">
            Projects, notes and a Daily Dose of engineering lessons on GenAI, agents and ML in production.
          </p>
        </div>
        <div>
          <h2 className="footer-heading">Explore</h2>
          <ul className="footer-list">
            <li>
              <Link href="/projects">Projects</Link>
            </li>
            <li>
              <Link href="/blog">Blog</Link>
            </li>
            <li>
              <Link href="/daily">Daily Dose</Link>
            </li>
            <li>
              <Link href="/daily/lessons">All lessons</Link>
            </li>
            <li>
              <Link href="/about">About</Link>
            </li>
          </ul>
        </div>
        <div>
          <h2 className="footer-heading">Topics</h2>
          <ul className="footer-list">
            {projectCategories.map((c) => (
              <li key={c}>
                <Link href={`/projects#${c.toLowerCase().replace(/[^a-z]+/g, "-")}`}>{c}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="footer-heading">Connect</h2>
          <ul className="footer-list">
            {profile.links.map((l) => (
              <li key={l.href}>
                <a href={l.href} target="_blank" rel="noopener noreferrer">
                  {l.label}
                </a>
              </li>
            ))}
            <li>
              <a href="/rss.xml">RSS feed</a>
            </li>
          </ul>
        </div>
      </div>
      <div className="footer-bottom">
        <div className="container footer-bottom-inner">
          <p>
            &copy; {year} {profile.name}
          </p>
          <Link href="/admin" className="footer-admin">
            Admin
          </Link>
        </div>
      </div>
    </footer>
  );
}
