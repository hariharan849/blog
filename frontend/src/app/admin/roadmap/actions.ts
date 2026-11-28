"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { parseRoadmap, ROADMAP_PATH, serializeRoadmap } from "@/lib/roadmap";
import { writeRepoFile } from "@/lib/repoFiles";

export type SaveResult = { ok: boolean; message: string; sha?: string };

/** Validates the edited roadmap and commits it to the repo; Vercel redeploys the public page from that commit. */
export async function saveRoadmap(input: unknown, sha: string | undefined): Promise<SaveResult> {
  try {
    const admin = await requireAdmin();
    const roadmap = parseRoadmap(input);
    await writeRepoFile(
      ROADMAP_PATH,
      serializeRoadmap(roadmap),
      `Update roadmap (from /admin by @${admin.login})`,
      sha,
    );
    revalidatePath("/admin/roadmap");
    return {
      ok: true,
      message: "Saved. The public roadmap updates after the next deploy, usually within two minutes.",
    };
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") return { ok: false, message: "Please sign in again." };
    return { ok: false, message: err instanceof Error ? err.message : "Couldn't save." };
  }
}
