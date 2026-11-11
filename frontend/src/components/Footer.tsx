import { profiles } from "@/lib/authors";

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <p>&copy; {year} PyChanter · Thoughts on AI, VFX and software</p>
        <div className="footer-authors">
          {profiles.map((p) => (
            <div key={p.username}>
              <span>{p.shortName}:</span>
              {p.links.map((l) => (
                <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer">
                  {l.label}
                </a>
              ))}
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
