import type { Metadata } from "next";
import { getAdmin } from "@/lib/auth";
import { feedApi, feedConfigured, FeedApiError, type Source } from "@/lib/feed";
import { AddSourceForm, RunNowButton, SignInButton, SignOutButton, SourceRow } from "./AdminClient";

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
            {error === "AccessDenied" ? "This GitHub account isn't allowed to sign in here." : "Sign-in failed. Please try again."}
          </p>
        )}
        <SignInButton />
      </section>
    );
  }

  let sources: Source[] = [];
  let loadError = "";
  if (!feedConfigured) {
    loadError = "FEED_API_URL isn't set, so the backend can't be reached.";
  } else {
    try {
      sources = await feedApi.sources();
    } catch (err) {
      loadError = err instanceof FeedApiError ? err.message : "Couldn't load sources.";
    }
  }

  return (
    <div className="narrow admin">
      <section className="hero admin-head">
        <div>
          <p className="eyebrow">Signed in as @{admin.login}</p>
          <h1>Daily Dose sources</h1>
          <p className="muted">
            Every night at 2 AM, new posts from these authors are collected, shown on Daily Dose and emailed to you.
          </p>
        </div>
        <SignOutButton />
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
