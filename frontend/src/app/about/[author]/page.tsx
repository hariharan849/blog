import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProfile, profiles } from "@/lib/authors";

type Props = { params: Promise<{ author: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return profiles.map((p) => ({ author: p.username }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const profile = getProfile((await params).author);
  return { title: profile ? `About ${profile.shortName}` : "About" };
}

export default async function AboutPage({ params }: Props) {
  const profile = getProfile((await params).author);
  if (!profile) notFound();

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
          <Link href={`/?author=${profile.username}`} className="button">
            Read {profile.shortName}&apos;s posts →
          </Link>
        </div>
      </div>
    </div>
  );
}
