import { profile } from "@/lib/profile";

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <p>
          &copy; {year} {profile.name} · Thoughts on AI, VFX and software
        </p>
        <div className="footer-links">
          {profile.links.map((l) => (
            <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer">
              {l.label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
