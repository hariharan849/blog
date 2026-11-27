import "server-only";

/**
 * Starts the "Daily lesson" GitHub Actions workflow on demand with a list of
 * links, and reads its recent runs. Needs LESSONS_GITHUB_TOKEN: a fine-grained
 * token for this repository with "Actions: Read and write".
 */
const TOKEN = process.env.LESSONS_GITHUB_TOKEN ?? "";
const REPO = process.env.LESSONS_GITHUB_REPO || "hariharan849/blog";
const REF = process.env.LESSONS_GITHUB_REF || "main";
const WORKFLOW = "daily-lesson.yml";

export const lessonRunsConfigured = Boolean(TOKEN);
export const MAX_LINKS = 10;

export type LessonRun = {
  id: number;
  status: string; // queued | in_progress | completed
  conclusion: string | null; // success | failure | cancelled | ...
  createdAt: string;
  url: string;
  event: string;
};

async function github(path: string, init: RequestInit = {}) {
  return fetch(`https://api.github.com/repos/${REPO}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${TOKEN}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
  });
}

/** Links from free text: one per line or separated by spaces, http(s) only, duplicates dropped. */
export function parseLinks(text: string): { links: string[]; invalid: string[] } {
  const links: string[] = [];
  const invalid: string[] = [];
  for (const raw of text.split(/\s+/).filter(Boolean)) {
    try {
      const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
      if (!/^https?:$/.test(url.protocol) || !url.hostname.includes(".")) throw new Error();
      const href = url.toString();
      if (!links.includes(href)) links.push(href);
    } catch {
      invalid.push(raw);
    }
  }
  return { links, invalid };
}

export async function startLessonRun(links: string[]) {
  if (!TOKEN) throw new Error("LESSONS_GITHUB_TOKEN isn't set.");
  const res = await github(`/actions/workflows/${WORKFLOW}/dispatches`, {
    method: "POST",
    body: JSON.stringify({ ref: REF, inputs: { urls: links.join(" ") } }),
  });
  if (res.status !== 204) {
    const detail = await res.text().catch(() => "");
    throw new Error(`GitHub refused to start the run (${res.status}). ${detail.slice(0, 200)}`.trim());
  }
}

export async function recentLessonRuns(limit = 5): Promise<LessonRun[]> {
  if (!TOKEN) return [];
  try {
    const res = await github(`/actions/workflows/${WORKFLOW}/runs?per_page=${limit}`);
    if (!res.ok) return [];
    const data = (await res.json()) as {
      workflow_runs: {
        id: number;
        status: string;
        conclusion: string | null;
        created_at: string;
        html_url: string;
        event: string;
      }[];
    };
    return data.workflow_runs.map((r) => ({
      id: r.id,
      status: r.status,
      conclusion: r.conclusion,
      createdAt: r.created_at,
      url: r.html_url,
      event: r.event,
    }));
  } catch {
    return [];
  }
}
