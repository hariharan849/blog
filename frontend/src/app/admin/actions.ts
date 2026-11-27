"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { feedApi, FeedApiError, type SourceKind } from "@/lib/feed";
import { MAX_LINKS, parseLinks, startLessonRun } from "@/lib/lessonRuns";

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };

const KINDS: SourceKind[] = ["medium", "substack", "rss"];

function fail(err: unknown): ActionResult {
  if (err instanceof FeedApiError) return { ok: false, message: err.message };
  if (err instanceof Error && err.message === "Unauthorized") return { ok: false, message: "Please sign in again." };
  console.error(err);
  return { ok: false, message: "Something went wrong. Please try again." };
}

export async function addSource(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const kind = String(formData.get("kind") ?? "") as SourceKind;
    const value = String(formData.get("value") ?? "").trim();
    if (!KINDS.includes(kind)) return { ok: false, message: "Choose Medium, Substack or RSS." };
    if (!value) return { ok: false, message: "Enter a username or URL." };
    const { source, preview } = await feedApi.addSource(kind, value);
    revalidatePath("/admin");
    const latest = preview.length ? ` Latest: “${preview[0]}”.` : "";
    return { ok: true, message: `Now following ${source.title}.${latest}` };
  } catch (err) {
    return fail(err);
  }
}

export async function toggleSource(id: string, enabled: boolean): Promise<ActionResult> {
  try {
    await requireAdmin();
    await feedApi.updateSource(id, { enabled });
    revalidatePath("/admin");
    return { ok: true, message: enabled ? "Resumed." : "Paused." };
  } catch (err) {
    return fail(err);
  }
}

export async function removeSource(id: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    await feedApi.deleteSource(id);
    revalidatePath("/admin");
    return { ok: true, message: "Removed." };
  } catch (err) {
    return fail(err);
  }
}

export async function runNow(): Promise<ActionResult> {
  try {
    await requireAdmin();
    await feedApi.runNow();
    revalidateTag("feed");
    return { ok: true, message: "Started. New posts will appear on Daily Dose in a minute or two." };
  } catch (err) {
    return fail(err);
  }
}

export async function queueReadingList(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  try {
    await requireAdmin();
    const { links, invalid } = parseLinks(String(formData.get("links") ?? ""));
    if (invalid.length) return { ok: false, message: `Not a link: ${invalid.slice(0, 3).join(", ")}` };
    if (!links.length) return { ok: false, message: "Paste at least one link." };
    if (links.length > MAX_LINKS) return { ok: false, message: `Up to ${MAX_LINKS} links per run, please.` };
    await startLessonRun(links);
    revalidatePath("/admin");
    const n = links.length === 1 ? "1 link" : `${links.length} links`;
    return {
      ok: true,
      message: `Started a run for ${n}. Lessons usually appear on Daily Dose in 3 to 5 minutes; links already published are skipped.`,
    };
  } catch (err) {
    if (err instanceof Error && err.message !== "Unauthorized" && !(err instanceof FeedApiError)) {
      return { ok: false, message: err.message };
    }
    return fail(err);
  }
}
