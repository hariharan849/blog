import type { Metadata } from "next";
import { getAdmin } from "@/lib/auth";
import { feedApi, feedConfigured, FeedApiError, type Source } from "@/lib/feed";
import { lessonRunsConfigured, MAX_LINKS, recentLessonRuns, type LessonRun } from "@/lib/lessonRuns";
import AdminTabs from "./AdminTabs";
import { AddSourceForm, ReadingListForm, RunNowButton, SignInButton, SignOutButton, SourceRow } from "./AdminClient";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ error?: string }> };

export default async function AdminPage({ searchParams }: Props) {
  const admin = await getAdmin();
  const { error } = await searchParams;

  if (!admin) {
    return (
      <section className="narrow hero">
        <h1>Admin</h1>
        <p className="muted">Sign in to manage the authors behind the Daily Dose.</p>
        {error && (
          <p className="field-error">
            {error === "AccessDenied"
              ? "This GitHub account isn't allowed to sign in here."
              : "Sign-in failed. Please try again."}
          </p>
        )}
        <SignInButton />
      </section>
    );
  }

  const runs = await recentLessonRuns();
  let sources: Source[] = [];
  let subscribers: { active: number; pending: number } | null = null;
  let loadError = "";
  if (!feedConfigured) {
    loadError = "FEED_API_URL isn't set, so the backend can't be reached.";
  } else {
    try {
      [sources, subscribers] = await Promise.all([feedApi.sources(), feedApi.subscriberCounts().catch(() => null)]);
    } catch (err) {
      loadError = err instanceof FeedApiError ? err.message : "Couldn't load sources.";
    }
  }

  return (
    <div className="narrow admin">
      <AdminTabs current="/admin" />
      <section className="hero admin-head">
        <div>
          <p className="eyebrow">Signed in as @{admin.login}</p>
          <h1>Daily Dose sources</h1>
          <p className="muted">
            Every night at 2 AM, new posts from these authors are collected, shown on Daily Dose and emailed to you.
          </p>
          {subscribers && (
            <p className="muted small">
              Email subscribers: {subscribers.active} confirmed
              {subscribers.pending > 0 && `, ${subscribers.pending} waiting to confirm`}
            </p>
          )}
        </div>
        <SignOutButton />
      </section>

      <section className="card admin-form">
        <div className="card-body">
          <h2>Reading list</h2>
          <p className="muted small">
            Paste articles, Substack or Medium posts, or GitHub repos (up to {MAX_LINKS}). Each becomes a Daily Dose
            lesson right away instead of waiting for 6 AM, and subscribers get it by email. Links that already have a
            lesson are skipped.
          </p>
          {!lessonRunsConfigured && (
            <p className="field-error small">
              Set LESSONS_GITHUB_TOKEN on Vercel (a GitHub token with Actions: read and write on this repository) to
              turn this on.
            </p>
          )}
          <ReadingListForm disabled={!lessonRunsConfigured} />
          {runs.length > 0 && <RecentRuns runs={runs} />}
        </div>
      </section>

      <AddSourceForm />

      <section className="section">
        <div className="section-head">
          <h2>
            Following <span className="muted small">({sources.length})</span>
          </h2>
          <RunNowButton />
        </div>
        {loadError && <p className="field-error">{loadError}</p>}
        {sources.length ? (
          <ul className="card source-list">
            {sources.map((s) => (
              <SourceRow key={s.id} source={s} />
            ))}
          </ul>
        ) : (
          !loadError && <p className="muted">No sources yet. Add a Medium or Substack author above.</p>
        )}
      </section>
    </div>
  );
}

function runLabel(run: LessonRun) {
  if (run.status !== "completed") return run.status === "queued" ? "Queued" : "Running";
  return run.conclusion === "success" ? "Done" : run.conclusion === "skipped" ? "Skipped" : "Failed";
}

function RecentRuns({ runs }: { runs: LessonRun[] }) {
  return (
    <div className="admin-runs">
      <p className="meta small">Recent lesson runs</p>
      <ul>
        {runs.map((r) => (
          <li key={r.id} className="small">
            <a href={r.url} target="_blank" rel="noopener noreferrer">
              {new Date(r.createdAt).toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </a>{" "}
            · {r.event === "schedule" ? "daily 6 AM" : "on demand"} ·{" "}
            <span className={`badge ${runLabel(r) === "Failed" ? "badge-warn" : "badge-muted"}`}>{runLabel(r)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
