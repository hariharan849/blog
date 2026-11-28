import "server-only";

/**
 * Reads and commits single files in this repository through the GitHub
 * contents API, for content edited from /admin. Needs a fine-grained token
 * with "Contents: read and write" on the repository: ADMIN_GITHUB_TOKEN, or
 * LESSONS_GITHUB_TOKEN if that one has the permission too.
 */
const TOKEN = process.env.ADMIN_GITHUB_TOKEN || process.env.LESSONS_GITHUB_TOKEN || "";
const REPO = process.env.LESSONS_GITHUB_REPO || "hariharan849/blog";
const BRANCH = process.env.LESSONS_GITHUB_REF || "main";

export const repoWritesConfigured = Boolean(TOKEN);

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

/** The file's text and blob sha on the branch, or null if it doesn't exist or can't be read. */
export async function readRepoFile(path: string): Promise<{ text: string; sha: string } | null> {
  if (!TOKEN) return null;
  const res = await github(`/contents/${encodeURI(path)}?ref=${encodeURIComponent(BRANCH)}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { content?: string; sha: string };
  return { text: Buffer.from(data.content ?? "", "base64").toString("utf8"), sha: data.sha };
}

/** Commits new content. Pass the sha you read so a concurrent edit is refused instead of overwritten. */
export async function writeRepoFile(path: string, text: string, message: string, sha?: string) {
  if (!TOKEN) throw new Error("ADMIN_GITHUB_TOKEN isn't set on Vercel.");
  const res = await github(`/contents/${encodeURI(path)}`, {
    method: "PUT",
    body: JSON.stringify({
      message,
      content: Buffer.from(text, "utf8").toString("base64"),
      branch: BRANCH,
      ...(sha ? { sha } : {}),
    }),
  });
  if (res.status === 409 || res.status === 422) {
    throw new Error("The file changed on GitHub since this page loaded. Reload and try again.");
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`GitHub refused the save (${res.status}). ${detail.slice(0, 160)}`.trim());
  }
}
