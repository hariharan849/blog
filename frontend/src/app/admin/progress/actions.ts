"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { readRepoFile, writeRepoFile } from "@/lib/repoFiles";
import { buildDraft, deleteDraft, progressFile, progressPath, saveDraft, type WeeklyDraft } from "@/lib/weekly";

export type DraftResult = { ok: boolean; message: string; draft?: WeeklyDraft | null };

const fail = (err: unknown): DraftResult => {
  if (err instanceof Error && err.message === "Unauthorized") return { ok: false, message: "Please sign in again." };
  console.error(err);
  return { ok: false, message: err instanceof Error ? err.message : "Something went wrong." };
};

function clean(input: Partial<WeeklyDraft>, base: WeeklyDraft): WeeklyDraft {
  const title = String(input.title ?? base.title)
    .trim()
    .slice(0, 140);
  const body = String(input.body ?? base.body).slice(0, 20_000);
  if (!title) throw new Error("Give the update a title.");
  if (!body.trim()) throw new Error("The update is empty.");
  return {
    ...base,
    title,
    body,
    summary: String(input.summary ?? base.summary)
      .trim()
      .slice(0, 300),
  };
}

/** Builds a fresh draft for the current week from todos, the roadmap and what was published. */
export async function generateDraft(): Promise<DraftResult> {
  try {
    await requireAdmin();
    const draft = await buildDraft();
    await saveDraft(draft);
    revalidatePath("/admin/progress");
    return { ok: true, message: "Drafted from this week's activity.", draft };
  } catch (err) {
    return fail(err);
  }
}

export async function saveDraftEdits(input: Partial<WeeklyDraft>, base: WeeklyDraft): Promise<DraftResult> {
  try {
    await requireAdmin();
    const draft = clean(input, base);
    await saveDraft(draft);
    return { ok: true, message: "Draft saved.", draft };
  } catch (err) {
    return fail(err);
  }
}

/** Commits the update to content/progress so it appears on /progress after the next deploy, then clears the draft. */
export async function publishDraft(input: Partial<WeeklyDraft>, base: WeeklyDraft): Promise<DraftResult> {
  try {
    const admin = await requireAdmin();
    const draft = clean(input, base);
    const path = progressPath(draft.weekEnding);
    const existing = await readRepoFile(path);
    await writeRepoFile(
      path,
      progressFile(draft),
      `Publish weekly update for ${draft.weekEnding} (from /admin by @${admin.login})`,
      existing?.sha,
    );
    await deleteDraft();
    revalidatePath("/admin/progress");
    return {
      ok: true,
      message: "Published. It appears on /progress after the next deploy, usually within two minutes.",
      draft: null,
    };
  } catch (err) {
    return fail(err);
  }
}

export async function discardDraft(): Promise<DraftResult> {
  try {
    await requireAdmin();
    await deleteDraft();
    revalidatePath("/admin/progress");
    return { ok: true, message: "Draft discarded.", draft: null };
  } catch (err) {
    return fail(err);
  }
}
