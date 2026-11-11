import type { Metadata } from "next";
import Link from "next/link";
import { profile } from "@/lib/profile";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  const initials = profile.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2);

  return (
    <div className="about">
      <section className="card">
        <div className="card-body about-grid">
          <div className="about-avatar">
            {profile.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar} alt={`${profile.name}'s profile picture`} width={200} height={200} />
            ) : (
              <div className="avatar-initials" aria-hidden="true">
                {initials}
              </div>
            )}
          </div>
          <div>
            <h1>{profile.name}</h1>
            <p className="muted">{profile.role}</p>
            {profile.about.map((para) => (
              <p key={para}>{para}</p>
            ))}
            <p className="about-links">
              {profile.links.map((l) => (
                <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className="button button-small">
                  {l.label}
                </a>
              ))}
              {profile.resume && (
                <a href={profile.resume} className="button button-small button-secondary">
                  Resume (PDF)
                </a>
              )}
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <h2>Skills</h2>
        <div className="grid grid-2">
          {profile.skills.map((s) => (
            <div key={s.group} className="card">
              <div className="card-body">
                <h3 className="skill-group">{s.group}</h3>
                <p className="tag-row">
                  {s.items.map((i) => (
                    <span key={i} className="badge badge-muted">
                      {i}
                    </span>
                  ))}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {profile.experience.length > 0 && (
        <section className="section">
          <h2>Experience</h2>
          <ol className="timeline">
            {profile.experience.map((e) => (
              <li key={`${e.company}-${e.period}`} className="card">
                <div className="card-body">
                  <p className="meta">{e.period}</p>
                  <h3>
                    {e.role} · {e.company}
                  </h3>
                  <ul>
                    {e.highlights.map((h) => (
                      <li key={h}>{h}</li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      <p>
        <Link href="/projects" className="button">
          See my projects →
        </Link>
      </p>
    </div>
  );
}
