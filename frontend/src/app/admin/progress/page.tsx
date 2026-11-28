import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/auth";
import { kvConfigured } from "@/lib/kv";
import { getProgressUpdates } from "@/lib/posts";
import { repoWritesConfigured } from "@/lib/repoFiles";
import { getDraft, type WeeklyDraft } from "@/lib/weekly";
import { formatDate } from "@/lib/format";
import AdminTabs from "../AdminTabs";
import DraftEditor from "./DraftEditor";

export const metadata: Metadata = { title: "Weekly updates", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminProgressPage() {
  if (!(await getAdmin())) redirect("/admin");
  let draft: WeeklyDraft | null = null;
  let loadError = "";
  try {
    draft = await getDraft();
  } catch (err) {
    console.error(err);
    loadError = "Couldn't reach Upstash Redis.";
  }
  const published = getProgressUpdates().slice(0, 8);

  return (
    <div className="narrow admin">
      <section className="hero">
        <AdminTabs current="/admin/progress" />
        <h1>Weekly updates</h1>
        <p className="muted">
          Every Sunday at 7 PM a draft is written from the todos you ticked off, roadmap goals in progress and anything
          published that week. Edit it here and publish it to <Link href="/progress">/progress</Link>.
        </p>
        {!kvConfigured && (
          <p className="field-error small">Drafts need Upstash Redis: connect it in Vercel (see Todos).</p>
        )}
        {!repoWritesConfigured && (
          <p className="field-error small">Publishing needs ADMIN_GITHUB_TOKEN on Vercel (Contents: read and write).</p>
        )}
        {loadError && <p className="field-error small">{loadError}</p>}
      </section>

      {kvConfigured && !loadError && <DraftEditor initial={draft} canPublish={repoWritesConfigured} />}

      {published.length > 0 && (
        <section className="section">
          <h2>Published</h2>
          <ul className="entry-list card index-card">
            {published.map((u) => (
              <li key={u.slug}>
                <Link href={`/progress#${u.slug}`} className="entry-title">
                  {u.title}
                </Link>
                <p className="entry-meta">
                  {formatDate(u.date)} · {u.summary}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
