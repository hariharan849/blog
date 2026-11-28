import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/auth";
import { currentQuarter, getRoadmap, parseRoadmap, ROADMAP_PATH } from "@/lib/roadmap";
import { readRepoFile, repoWritesConfigured } from "@/lib/repoFiles";
import AdminTabs from "../AdminTabs";
import RoadmapEditor from "./RoadmapEditor";

export const metadata: Metadata = { title: "Edit roadmap", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminRoadmapPage() {
  if (!(await getAdmin())) redirect("/admin");

  // Edit the latest committed version, so saves made since the last deploy aren't lost.
  const file = await readRepoFile(ROADMAP_PATH);
  let roadmap = getRoadmap();
  if (file) {
    try {
      roadmap = parseRoadmap(JSON.parse(file.text));
    } catch {
      /* fall back to the deployed copy */
    }
  }

  return (
    <div className="narrow admin">
      <section className="hero">
        <AdminTabs current="/admin/roadmap" />
        <h1>Roadmap</h1>
        <p className="muted">
          Everything here is public on <Link href="/roadmap">/roadmap</Link> (and in the public GitHub repo). Keep
          private plans in <Link href="/admin/todos">Todos</Link>.
        </p>
        {!repoWritesConfigured && (
          <p className="field-error small">
            Saving needs ADMIN_GITHUB_TOKEN on Vercel: a fine-grained GitHub token for this repository with
            &ldquo;Contents: read and write&rdquo;.
          </p>
        )}
      </section>
      <RoadmapEditor
        initial={roadmap.goals}
        sha={file?.sha}
        defaultQuarter={currentQuarter()}
        canSave={repoWritesConfigured}
      />
    </div>
  );
}
