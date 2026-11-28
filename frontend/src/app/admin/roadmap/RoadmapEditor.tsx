"use client";

import { useState, useTransition } from "react";
import { STATUS_LABEL, STATUSES, type Goal, type GoalStatus } from "@/lib/roadmapTypes";
import { saveRoadmap, type SaveResult } from "./actions";

type Draft = Goal & { linksText: string };

const toDraft = (g: Goal): Draft => ({ ...g, linksText: g.links.map((l) => `${l.label} | ${l.href}`).join("\n") });

const fromDraft = ({ linksText, ...g }: Draft): Goal => ({
  ...g,
  links: linksText
    .split("\n")
    .map((line) => line.split("|").map((s) => s.trim()))
    .filter(([label, href]) => label && href)
    .map(([label, href]) => ({ label, href })),
});

export default function RoadmapEditor({
  initial,
  sha: initialSha,
  defaultQuarter,
  canSave,
}: {
  initial: Goal[];
  sha?: string;
  defaultQuarter: string;
  canSave: boolean;
}) {
  const [goals, setGoals] = useState<Draft[]>(initial.map(toDraft));
  const [sha, setSha] = useState(initialSha);
  const [dirty, setDirty] = useState(false);
  const [result, setResult] = useState<SaveResult | null>(null);
  const [pending, start] = useTransition();

  const edit = (i: number, patch: Partial<Draft>) => {
    setGoals((all) => all.map((g, j) => (j === i ? { ...g, ...patch } : g)));
    setDirty(true);
    setResult(null);
  };
  const move = (i: number, by: number) => {
    setGoals((all) => {
      const next = [...all];
      const [g] = next.splice(i, 1);
      next.splice(Math.max(0, Math.min(next.length, i + by)), 0, g);
      return next;
    });
    setDirty(true);
  };
  const add = () => {
    setGoals((all) => [
      {
        id: "",
        title: "",
        description: "",
        quarter: defaultQuarter,
        status: "planned",
        progress: 0,
        links: [],
        linksText: "",
      },
      ...all,
    ]);
    setDirty(true);
  };
  const remove = (i: number) => {
    setGoals((all) => all.filter((_, j) => j !== i));
    setDirty(true);
  };
  const save = () =>
    start(async () => {
      const res = await saveRoadmap({ goals: goals.map(fromDraft) }, sha);
      setResult(res);
      if (res.ok) {
        setDirty(false);
        setSha(undefined); // the file has a new sha now; the next save overwrites without the check
      }
    });

  return (
    <>
      <button type="button" className="button button-secondary" onClick={add} style={{ marginBottom: "1rem" }}>
        + Add a goal
      </button>
      <ol className="editor-list">
        {goals.map((g, i) => (
          <li key={i} className="editor-item">
            <div className="editor-grid">
              <label className="span-all">
                Goal
                <input
                  value={g.title}
                  maxLength={140}
                  placeholder="e.g. Ship an MCP server to production"
                  onChange={(e) => edit(i, { title: e.target.value })}
                />
              </label>
              <label className="span-all">
                Why / what done looks like
                <textarea
                  rows={2}
                  value={g.description}
                  maxLength={600}
                  onChange={(e) => edit(i, { description: e.target.value })}
                />
              </label>
              <label>
                Quarter
                <input
                  value={g.quarter}
                  placeholder="2026 Q4"
                  pattern="\d{4} Q[1-4]"
                  onChange={(e) => edit(i, { quarter: e.target.value })}
                />
              </label>
              <label>
                Status
                <select
                  value={g.status}
                  onChange={(e) => {
                    const status = e.target.value as GoalStatus;
                    edit(i, { status, progress: status === "done" ? 100 : g.progress });
                  }}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Progress: {g.progress}%
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={g.progress}
                  onChange={(e) => edit(i, { progress: Number(e.target.value) })}
                />
              </label>
              <label className="span-all">
                Links, one per line as &ldquo;Label | /path or https://…&rdquo;
                <textarea
                  rows={2}
                  value={g.linksText}
                  placeholder="Project page | /projects/vllm-serve"
                  onChange={(e) => edit(i, { linksText: e.target.value })}
                />
              </label>
            </div>
            <div className="editor-actions">
              <button
                type="button"
                className="button button-secondary button-small"
                onClick={() => move(i, -1)}
                disabled={i === 0}
              >
                ↑ Up
              </button>
              <button
                type="button"
                className="button button-secondary button-small"
                onClick={() => move(i, 1)}
                disabled={i === goals.length - 1}
              >
                ↓ Down
              </button>
              <button type="button" className="button button-danger button-small" onClick={() => remove(i)}>
                Delete
              </button>
            </div>
          </li>
        ))}
      </ol>
      <div className="editor-bar">
        <span className="grow small muted" role="status">
          {result ? (
            <span className={result.ok ? "success" : "field-error"}>{result.message}</span>
          ) : dirty ? (
            "Unsaved changes"
          ) : (
            `${goals.length} goals`
          )}
        </span>
        <button type="button" className="button" onClick={save} disabled={!canSave || pending || !dirty}>
          {pending ? "Saving…" : "Save roadmap"}
        </button>
      </div>
    </>
  );
}
