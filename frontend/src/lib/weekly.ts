import "server-only";
import { kv, kvConfigured, KEY_PREFIX } from "./kv";
import { getLessons, getPosts } from "./posts";
import { getRoadmap, STATUS_LABEL } from "./roadmap";
import { todosDoneBetween } from "./todos";

/**
 * Weekly progress updates. Each Sunday evening a Vercel cron job drafts the
 * week from facts the site already has (todos ticked off, roadmap goals in
 * progress, posts and lessons published); the draft waits in Redis until it
 * is edited and published from /admin/progress, which commits it to
 * content/progress/<week-ending date>.md for the public /progress page.
 */
export type WeeklyDraft = { weekEnding: string; title: string; summary: string; body: string; createdAt: string };

const DRAFT_KEY = `${KEY_PREFIX}weekly-draft`;
const IST_OFFSET_MS = 330 * 60_000;

/** Monday 00:00 IST of the week containing `now`, and the Sunday date (YYYY-MM-DD, IST) that ends it. */
export function weekBounds(now = new Date()) {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const day = (ist.getUTCDay() + 6) % 7; // Monday = 0
  const mondayIst = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() - day);
  const start = new Date(mondayIst - IST_OFFSET_MS);
  const end = new Date(start.getTime() + 7 * 86400_000);
  const weekEnding = new Date(mondayIst + 6 * 86400_000).toISOString().slice(0, 10);
  return { start, end, weekEnding };
}

const inRange = (date: string, start: Date, end: Date) => {
  const d = `${date}T12:00:00+05:30`;
  return new Date(d) >= start && new Date(d) < end;
};

export async function buildDraft(now = new Date()): Promise<WeeklyDraft> {
  const { start, end, weekEnding } = weekBounds(now);
  const done = kvConfigured ? await todosDoneBetween(start, end) : [];
  const goals = getRoadmap().goals;
  const active = goals.filter((g) => g.status === "in-progress");
  const posts = getPosts().filter((p) => !p.draft && inRange(p.date, start, end));
  const lessons = getLessons().filter((l) => inRange(l.date, start, end));
  const goalTitle = (id?: string) => goals.find((g) => g.id === id)?.title;

  const lines: string[] = [];
  lines.push("## What I got done", "");
  if (done.length)
    for (const t of done) lines.push(`- ${t.text}${goalTitle(t.goalId) ? ` (towards *${goalTitle(t.goalId)}*)` : ""}`);
  else lines.push("- _Add what you finished this week._");
  if (posts.length || lessons.length) {
    lines.push("", "## Published", "");
    for (const p of posts) lines.push(`- Blog: [${p.title}](/blog/${p.slug})`);
    for (const l of lessons) lines.push(`- Daily Dose: [${l.title}](/daily/lessons/${l.slug})`);
  }
  if (active.length) {
    lines.push("", "## Roadmap", "");
    for (const g of active) lines.push(`- ${g.title}: ${g.progress}% (${STATUS_LABEL[g.status].toLowerCase()})`);
  }
  lines.push(
    "",
    "## What I learned",
    "",
    "- _One or two things worth remembering._",
    "",
    "## Next week",
    "",
    "- _The plan for next week._",
  );

  const weekLabel = new Date(`${weekEnding}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return {
    weekEnding,
    title: `Week ending ${weekLabel}`,
    summary: `${done.length} task${done.length === 1 ? "" : "s"} done${posts.length + lessons.length ? `, ${posts.length + lessons.length} published` : ""}.`,
    body: lines.join("\n"),
    createdAt: new Date().toISOString(),
  };
}

export async function getDraft(): Promise<WeeklyDraft | null> {
  if (!kvConfigured) return null;
  return (await kv().get<WeeklyDraft>(DRAFT_KEY)) ?? null;
}

export async function saveDraft(draft: WeeklyDraft) {
  await kv().set(DRAFT_KEY, draft);
}

export async function deleteDraft() {
  await kv().del(DRAFT_KEY);
}

/** Markdown file for a published update, in the same front-matter format as posts. */
export function progressFile(d: Pick<WeeklyDraft, "weekEnding" | "title" | "summary" | "body">) {
  const q = (s: string) => JSON.stringify(s);
  return `---\ntitle: ${q(d.title)}\ndate: ${d.weekEnding}\nsummary: ${q(d.summary)}\ntags: [progress]\n---\n\n${d.body.trim()}\n`;
}

export const progressPath = (weekEnding: string) => `frontend/content/progress/${weekEnding}-weekly-update.md`;
