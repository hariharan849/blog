import type { Metadata } from "next";
import Link from "next/link";
import { currentQuarter, getRoadmap, quarterKey, STATUS_LABEL, type Goal } from "@/lib/roadmap";

export const metadata: Metadata = {
  title: "Roadmap",
  description: "What I'm learning and building, quarter by quarter, and how far along each goal is.",
};

// Re-render daily so "Now / Next / Done" follows the calendar between deploys.
export const revalidate = 86400;

const isExternal = (href: string) => /^https?:\/\//.test(href);

function GoalCard({ goal }: { goal: Goal }) {
  return (
    <li className={`card goal goal-${goal.status}`}>
      <div className="card-body">
        <div className="goal-head">
          <h3 className="goal-title">{goal.title}</h3>
          <span className={`goal-status goal-status-${goal.status}`}>{STATUS_LABEL[goal.status]}</span>
        </div>
        {goal.description && <p className="excerpt">{goal.description}</p>}
        <div
          className="goal-bar"
          role="progressbar"
          aria-valuenow={goal.progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${goal.title}: ${goal.progress}% done`}
        >
          <span style={{ width: `${goal.progress}%` }} />
        </div>
        <p className="goal-meta">
          <span>{goal.progress}%</span>
          {goal.links.map((l) =>
            isExternal(l.href) ? (
              <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer">
                {l.label} ↗
              </a>
            ) : (
              <Link key={l.href} href={l.href}>
                {l.label} →
              </Link>
            ),
          )}
        </p>
      </div>
    </li>
  );
}

export default function RoadmapPage() {
  const { goals } = getRoadmap();
  const now = quarterKey(currentQuarter());
  const quarters = [...new Set(goals.map((g) => g.quarter))].sort((a, b) => quarterKey(b) - quarterKey(a));
  const done = goals.filter((g) => g.status === "done").length;
  const active = goals.filter((g) => g.status === "in-progress").length;

  const label = (q: string) => {
    const k = quarterKey(q);
    return k === now ? `${q} · Now` : k > now ? `${q} · Next` : q;
  };

  return (
    <>
      <section className="hero">
        <p className="eyebrow">Roadmap</p>
        <h1>What I&apos;m working towards</h1>
        <p className="lead">
          My learning and building goals, quarter by quarter. Progress here is updated as I go; the{" "}
          <Link href="/progress">weekly updates</Link> say what moved.
        </p>
        {goals.length > 0 && (
          <p className="roadmap-stats">
            <span>
              <strong>{goals.length}</strong> goals
            </span>
            <span>
              <strong>{active}</strong> in progress
            </span>
            <span>
              <strong>{done}</strong> done
            </span>
          </p>
        )}
      </section>

      {quarters.length ? (
        quarters.map((q) => (
          <section key={q} className="section roadmap-quarter">
            <h2 className={quarterKey(q) === now ? "roadmap-now" : undefined}>{label(q)}</h2>
            <ul className="goal-list">
              {goals
                .filter((g) => g.quarter === q)
                .sort(
                  (a, b) =>
                    ["in-progress", "planned", "paused", "done"].indexOf(a.status) -
                    ["in-progress", "planned", "paused", "done"].indexOf(b.status),
                )
                .map((g) => (
                  <GoalCard key={g.id} goal={g} />
                ))}
            </ul>
          </section>
        ))
      ) : (
        <p className="muted empty">The roadmap is being written. Check back soon.</p>
      )}
    </>
  );
}
