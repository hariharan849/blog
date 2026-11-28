import fs from "node:fs";
import path from "node:path";

/**
 * Public learning and career roadmap, stored in content/roadmap.json and
 * edited from /admin/roadmap (which commits the file back to the repo).
 * This repository is public, so everything in the file is public too.
 */
import { STATUSES, type Goal, type GoalLink, type GoalStatus, type Roadmap } from "./roadmapTypes";

export { STATUSES, STATUS_LABEL } from "./roadmapTypes";
export type { Goal, GoalLink, GoalStatus, Roadmap } from "./roadmapTypes";

export const ROADMAP_PATH = "frontend/content/roadmap.json";
const QUARTER_RE = /^(\d{4}) Q([1-4])$/;

export const quarterKey = (q: string) => {
  const m = q.match(QUARTER_RE);
  return m ? Number(m[1]) * 10 + Number(m[2]) : 0;
};

export function currentQuarter(d = new Date()) {
  return `${d.getUTCFullYear()} Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "goal";

const safeHref = (href: string) => /^(\/(?!\/)|https?:\/\/)/.test(href);

/** Validates and normalises untrusted input (from the admin form or the file). Throws with a readable message. */
export function parseRoadmap(input: unknown): Roadmap {
  const raw = (input as { goals?: unknown })?.goals;
  if (!Array.isArray(raw)) throw new Error("The roadmap must have a list of goals.");
  if (raw.length > 200) throw new Error("Keep the roadmap under 200 goals.");
  const ids = new Set<string>();
  const goals = raw.map((g, i): Goal => {
    const o = (g ?? {}) as Record<string, unknown>;
    const title = String(o.title ?? "")
      .trim()
      .slice(0, 140);
    if (!title) throw new Error(`Goal ${i + 1} needs a title.`);
    const quarter = String(o.quarter ?? "").trim();
    if (!QUARTER_RE.test(quarter)) throw new Error(`"${title}": quarter must look like 2026 Q4.`);
    const status = String(o.status ?? "planned") as GoalStatus;
    if (!STATUSES.includes(status)) throw new Error(`"${title}": unknown status.`);
    let progress = Math.round(Number(o.progress ?? 0));
    if (!Number.isFinite(progress)) progress = 0;
    progress = status === "done" ? 100 : Math.min(100, Math.max(0, progress));
    const links = (Array.isArray(o.links) ? o.links : [])
      .map((l) => ({
        label: String((l as GoalLink)?.label ?? "")
          .trim()
          .slice(0, 60),
        href: String((l as GoalLink)?.href ?? "")
          .trim()
          .slice(0, 500),
      }))
      .filter((l) => l.label && l.href);
    for (const l of links) if (!safeHref(l.href)) throw new Error(`"${title}": links must start with / or https://`);
    let id = slug(String(o.id ?? "") || title);
    while (ids.has(id)) id = `${id}-${i}`;
    ids.add(id);
    return {
      id,
      title,
      description: String(o.description ?? "")
        .trim()
        .slice(0, 600),
      quarter,
      status,
      progress,
      links: links.slice(0, 5),
    };
  });
  return { goals };
}

export function serializeRoadmap(r: Roadmap) {
  return `${JSON.stringify(r, null, 2)}\n`;
}

/** The roadmap as deployed with this build. */
export function getRoadmap(): Roadmap {
  try {
    return parseRoadmap(JSON.parse(fs.readFileSync(path.join(process.cwd(), "content", "roadmap.json"), "utf8")));
  } catch (err) {
    console.error("roadmap.json is invalid:", err);
    return { goals: [] };
  }
}
