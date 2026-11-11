import type { Metadata } from "next";
import Link from "next/link";
import { profile } from "@/lib/profile";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <div className="about card">
      <div className="card-body about-grid">
        <div className="about-avatar">
          {profile.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatar} alt={`${profile.name}'s profile picture`} width={200} height={200} />
          ) : (
            <div className="avatar-initials" aria-hidden="true">
              {profile.name
                .split(" ")
                .map((w) => w[0])
                .join("")
                .slice(0, 2)}
            </div>
          )}
        </div>
        <div>
          <h1>About Me</h1>
          <p className="muted">{profile.role}</p>
          <p>{profile.intro}</p>
          <h2>My Expertise</h2>
          <ul>
            {profile.expertise.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
          <h2>Why This Blog?</h2>
          <p>{profile.why}</p>
          <p className="about-links">
            {profile.links.map((l) => (
              <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className="button button-small">
                {l.label}
              </a>
            ))}
          </p>
          <Link href="/" className="button">
            Read my posts →
          </Link>
        </div>
      </div>
    </div>
  );
}
