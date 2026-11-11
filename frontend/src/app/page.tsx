import Link from "next/link";
import { profile } from "@/lib/profile";
import { projects } from "@/lib/projects";
import { getPosts } from "@/lib/posts";
import { feedApi, safeFeed } from "@/lib/feed";
import { formatDay } from "@/lib/format";
import ProjectCard from "@/components/ProjectCard";
import PostCard from "@/components/PostCard";
import FeedItemCard from "@/components/FeedItemCard";

export const revalidate = 300;

export default async function HomePage() {
  const featured = projects.filter((p) => p.featured).slice(0, 6);
  const posts = getPosts().slice(0, 3);
  const today = await safeFeed(feedApi.day());

  return (
    <>
      <section className="hero hero-home">
        <p className="eyebrow">{profile.role}</p>
        <h1>{profile.headline}</h1>
        <p className="lead">{profile.intro}</p>
        <div className="actions">
          <Link href="/projects" className="button">
            See my work
          </Link>
          <Link href="/daily" className="button button-secondary">
            Today&apos;s Daily Dose
          </Link>
          {profile.resume && (
            <a href={profile.resume} className="button button-secondary">
              Resume
            </a>
          )}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Featured projects</h2>
          <Link href="/projects">All projects →</Link>
        </div>
        <div className="grid grid-3">
          {featured.map((p) => (
            <ProjectCard key={p.name} project={p} />
          ))}
        </div>
      </section>

      {today?.day && today.items.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>
              Daily Dose <span className="muted small">· {formatDay(today.day)}</span>
            </h2>
            <Link href="/daily">All {today.items.length} picks →</Link>
          </div>
          <div className="stack">
            {today.items.slice(0, 3).map((item) => (
              <FeedItemCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}

      {posts.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>Latest writing</h2>
            <Link href="/blog">All posts →</Link>
          </div>
          <div className="grid grid-3">
            {posts.map((p) => (
              <PostCard key={p.slug} post={p} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
