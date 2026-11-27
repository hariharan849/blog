import Link from "next/link";
import { profile } from "@/lib/profile";
import { projectCategories, projects } from "@/lib/projects";
import { getLessons, getPosts } from "@/lib/posts";
import { formatDate } from "@/lib/format";
import HeroArt from "@/components/HeroArt";
import SubscribeForm from "@/components/SubscribeForm";

export const revalidate = 300;

const anchor = (c: string) => c.toLowerCase().replace(/[^a-z]+/g, "-");

/** One-line lead for each topic block on the home page. */
const TOPIC_LEAD: Record<string, string> = {
  "GenAI & Agents": "Multi-agent systems, retrieval and LLM apps built to run in production, not just in a notebook.",
  MLOps: "Pipelines, orchestration and serving: the plumbing that turns a model into a dependable service.",
  "Deep Learning": "Vision and learning projects, from training loops to deployable models.",
  Tools: "Desktop and pipeline tools that make engineers faster.",
};

const ICONS: Record<string, string> = {
  "GenAI & Agents": "M12 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm-7 12a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm14 0a3 3 0 1 1 0 6 3 3 0 0 1 0-6ZM12 9v3m0 0-5 4m5-4 5 4",
  MLOps: "M4 6h16M4 12h16M4 18h10m3 0 2 2 3-4",
  "Deep Learning": "M4 7l8-4 8 4-8 4-8-4Zm0 5 8 4 8-4M4 17l8 4 8-4",
  Tools: "M14 6a4 4 0 0 0-5 5l-6 6 3 3 6-6a4 4 0 0 0 5-5l-2 2-3-1-1-3 3-2Z",
  "Daily lessons": "M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Zm0 13a3 3 0 0 1 3-3h11",
  Writing: "M4 20h4L19 9l-4-4L4 16v4Zm9-13 4 4",
  "Daily Dose": "M12 3v3m0 12v3M3 12h3m12 0h3M6 6l2 2m8 8 2 2M6 18l2-2m8-8 2-2M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z",
  About: "M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm-7 16a7 7 0 0 1 14 0",
};

function Icon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" className="topic-icon" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

export default async function HomePage() {
  const lessons = getLessons();
  const lesson = lessons[0];
  const recent = [
    ...lessons.map((l) => ({ ...l, kind: "Daily lesson", href: `/daily/lessons/${l.slug}` })),
    ...getPosts().map((p) => ({ ...p, kind: "Blog", href: `/blog/${p.slug}` })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6);
  const stack = Array.from(new Set(profile.skills.slice(0, 3).flatMap((s) => s.items))).slice(0, 12);
  const tiles = [
    ...projectCategories.map((c) => ({ name: c, href: `/projects#${anchor(c)}` })),
    { name: "Daily lessons", href: "/daily/lessons" },
    { name: "Daily Dose", href: "/daily" },
    { name: "Writing", href: "/blog" },
    { name: "About", href: "/about" },
  ];

  return (
    <>
      <section className="banner home-hero">
        <div className="home-hero-grid">
          <div>
            <p className="banner-eyebrow">{profile.role}</p>
            <h1>{profile.headline}</h1>
            <ul className="hero-points">
              <li>
                <strong>Agents that ship:</strong> multi-agent systems with LangGraph, A2A and MCP.
              </li>
              <li>
                <strong>Retrieval that holds up:</strong> hybrid search, evaluation and observability.
              </li>
              <li>
                <strong>A Daily Dose:</strong> one short engineering lesson every morning.
              </li>
            </ul>
            <div className="actions">
              <Link href={lesson ? `/daily/lessons/${lesson.slug}` : "/daily"} className="button button-large">
                Start with today&apos;s lesson
              </Link>
              <Link href="/projects" className="button button-large button-secondary">
                Explore projects
              </Link>
            </div>
          </div>
          <HeroArt />
        </div>
      </section>

      <section className="stack-strip" aria-label="Tools I work with">
        <p className="stack-strip-label">Built with</p>
        <ul>
          {stack.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </section>

      <section className="section">
        <h2 className="section-title">Where should you start?</h2>
        <p className="lead">
          The work here is grouped by topic. Pick one, read the featured projects, then follow the links to the code on
          GitHub.
        </p>
        <div className="topic-blocks">
          {projectCategories.map((cat) => {
            const list = projects.filter((p) => p.category === cat);
            if (!list.length) return null;
            return (
              <section key={cat} className="topic-block">
                <div className="topic-block-head">
                  <Icon name={cat} />
                  <h3>{cat}</h3>
                </div>
                <p className="topic-block-lead">
                  <strong>{TOPIC_LEAD[cat]}</strong>
                </p>
                <p className="kicker">Featured projects</p>
                <ul className="entry-list">
                  {list.slice(0, 3).map((p) => (
                    <li key={p.name}>
                      <a href={p.repo} target="_blank" rel="noopener noreferrer" className="entry-title">
                        {p.name}
                      </a>
                      <p className="entry-meta">{p.tags.slice(0, 4).join(" · ")}</p>
                      <p className="entry-excerpt">{p.summary}</p>
                    </li>
                  ))}
                </ul>
                <Link href={`/projects#${anchor(cat)}`} className="read-more">
                  See all {list.length} {cat} projects <span aria-hidden="true">→</span>
                </Link>
              </section>
            );
          })}
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">All topics</h2>
        <div className="topic-grid">
          {tiles.map((t) => (
            <Link key={t.name} href={t.href} className="topic-tile">
              <Icon name={t.name} />
              <span>{t.name}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="section about-band card">
        <div className="card-body about-band-body">
          <div>
            <p className="kicker">About me</p>
            <h2>Hi, I&apos;m {profile.shortName}.</h2>
            <p>
              <strong>{profile.role}.</strong> {profile.about[1]}
            </p>
            <Link href="/about" className="button">
              Read my story
            </Link>
          </div>
          <ul className="about-band-skills">
            {profile.skills.slice(0, 4).map((g) => (
              <li key={g.group}>
                <strong>{g.group}</strong>
                <span>{g.items.slice(0, 5).join(", ")}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {recent.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2 className="section-title">Recent lessons and posts</h2>
            <Link href="/daily/lessons">See all lessons →</Link>
          </div>
          <div className="grid grid-3">
            {recent.map((r) => (
              <article key={r.href} className="card tile">
                <div className="card-body tile-body">
                  <p className="tag-row tile-tags">
                    <span className="badge">{r.kind}</span>
                    {r.tags.slice(0, 2).map((t) => (
                      <span key={t} className="badge badge-muted">
                        #{t}
                      </span>
                    ))}
                  </p>
                  <h3 className="tile-title">
                    <Link href={r.href}>{r.title}</Link>
                  </h3>
                  <p className="meta">
                    <time dateTime={r.date}>{formatDate(r.date)}</time> · {r.readingMinutes} min read
                  </p>
                  {r.summary && <p className="excerpt">{r.summary}</p>}
                  <Link href={r.href} className="read-more">
                    Read more <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="banner cta-band">
        <div className="cta-band-grid">
          <div>
            <h2>One engineering lesson, every morning.</h2>
            <p className="banner-lead">
              The Daily Dose turns a talk or article worth knowing into a few minutes of reading. Free, and one click to
              unsubscribe.
            </p>
          </div>
          <SubscribeForm />
        </div>
      </section>
    </>
  );
}
