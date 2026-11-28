/** Roadmap types and labels, safe to import from client components (no fs). */
export const STATUSES = ["planned", "in-progress", "done", "paused"] as const;
export type GoalStatus = (typeof STATUSES)[number];
export const STATUS_LABEL: Record<GoalStatus, string> = {
  planned: "Planned",
  "in-progress": "In progress",
  done: "Done",
  paused: "Paused",
};

export type GoalLink = { label: string; href: string };
export type Goal = {
  id: string;
  title: string;
  description: string;
  /** e.g. "2026 Q4" */
  quarter: string;
  status: GoalStatus;
  /** 0 to 100 */
  progress: number;
  links: GoalLink[];
};
export type Roadmap = { goals: Goal[] };
