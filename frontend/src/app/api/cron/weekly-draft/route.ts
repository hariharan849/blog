import { buildDraft, getDraft, saveDraft } from "@/lib/weekly";
import { kvConfigured } from "@/lib/kv";

/**
 * Vercel Cron (see vercel.json): Sunday 19:00 IST. Drafts this week's progress
 * update unless a draft for the same week already exists. Vercel sends
 * "Authorization: Bearer $CRON_SECRET" when CRON_SECRET is set.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!kvConfigured) return Response.json({ error: "Upstash Redis isn't connected." }, { status: 503 });
  const draft = await buildDraft();
  const existing = await getDraft();
  if (existing?.weekEnding === draft.weekEnding) return Response.json({ ok: true, skipped: "draft exists" });
  await saveDraft(draft);
  return Response.json({ ok: true, weekEnding: draft.weekEnding });
}
