"use client";

import { useState, useTransition, type FormEvent } from "react";
import type { Todo } from "@/lib/todos";
import { addTodo, clearOldDone, deleteTodo, editTodo, moveTodo, setTodoDone, type TodoResult } from "./actions";

type GoalOption = { id: string; title: string };
type Filter = "open" | "done" | "all";

const today = () => new Date().toISOString().slice(0, 10);

function dueLabel(due?: string) {
  if (!due) return null;
  const t = today();
  const cls = due < t ? "todo-due todo-overdue" : due === t ? "todo-due todo-today" : "todo-due";
  const text =
    due === t ? "Today" : new Date(`${due}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return <span className={cls}>{due < t ? `Overdue · ${text}` : text}</span>;
}

export default function TodoList({ initial, goals }: { initial: Todo[]; goals: GoalOption[] }) {
  const [todos, setTodos] = useState(initial);
  const [filter, setFilter] = useState<Filter>("open");
  const [text, setText] = useState("");
  const [due, setDue] = useState("");
  const [goalId, setGoalId] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const apply = (p: Promise<TodoResult>, after?: () => void) =>
    start(async () => {
      const res = await p;
      if (res.ok && res.todos) {
        setTodos(res.todos);
        setError("");
        after?.();
      } else setError(res.message ?? "Couldn't save.");
    });

  const onAdd = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    apply(addTodo(text, due, goalId), () => {
      setText("");
      setDue("");
    });
  };

  const goalTitle = (id?: string) => goals.find((g) => g.id === id)?.title;
  const open = todos.filter((t) => !t.done);
  const done = todos.filter((t) => t.done).sort((a, b) => (b.doneAt ?? "").localeCompare(a.doneAt ?? ""));
  const shown = filter === "open" ? open : filter === "done" ? done : [...open, ...done];
  const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
  const doneThisWeek = done.filter((t) => (t.doneAt ?? "") >= weekAgo).length;

  return (
    <>
      <form className="card admin-form" onSubmit={onAdd}>
        <div className="card-body">
          <div className="admin-form-row">
            <label className="grow">
              New task
              <input
                value={text}
                maxLength={280}
                placeholder="e.g. Read the A2A spec section on agent cards"
                onChange={(e) => setText(e.target.value)}
              />
            </label>
            <label>
              Due
              <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </label>
            {goals.length > 0 && (
              <label>
                Roadmap goal
                <select value={goalId} onChange={(e) => setGoalId(e.target.value)}>
                  <option value="">None</option>
                  {goals.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title.length > 40 ? `${g.title.slice(0, 40)}…` : g.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button type="submit" className="button" disabled={pending || !text.trim()}>
              Add
            </button>
          </div>
          {error && <p className="field-error">{error}</p>}
        </div>
      </form>

      <div className="todo-toolbar">
        <nav className="view-tabs" aria-label="Filter tasks">
          {(["open", "done", "all"] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              className={filter === f ? "active" : undefined}
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
            >
              {f === "open" ? `To do ${open.length}` : f === "done" ? `Done ${done.length}` : "All"}
            </button>
          ))}
        </nav>
        <span className="muted small">{doneThisWeek} done in the last 7 days</span>
      </div>

      {shown.length === 0 ? (
        <p className="muted empty">{filter === "open" ? "Nothing to do. Add a task above." : "Nothing here yet."}</p>
      ) : (
        <ul className="card todo-list" aria-busy={pending}>
          {shown.map((t, i) => (
            <li key={t.id} className={t.done ? "todo todo-done" : "todo"}>
              <input
                type="checkbox"
                checked={t.done}
                aria-label={t.done ? `Mark "${t.text}" as not done` : `Mark "${t.text}" as done`}
                onChange={(e) => apply(setTodoDone(t.id, e.target.checked))}
              />
              {editing === t.id ? (
                <form
                  className="todo-edit"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    apply(editTodo(t.id, { text: String(f.get("text")), due: String(f.get("due") ?? "") }), () =>
                      setEditing(null),
                    );
                  }}
                >
                  <input name="text" defaultValue={t.text} maxLength={280} autoFocus />
                  <input name="due" type="date" defaultValue={t.due ?? ""} />
                  <button type="submit" className="button button-small">
                    Save
                  </button>
                  <button
                    type="button"
                    className="button button-secondary button-small"
                    onClick={() => setEditing(null)}
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <div className="todo-body">
                  <span className="todo-text">{t.text}</span>
                  <span className="todo-meta">
                    {!t.done && dueLabel(t.due)}
                    {goalTitle(t.goalId) && <span className="todo-goal">→ {goalTitle(t.goalId)}</span>}
                    {t.done && t.doneAt && (
                      <span>
                        Done {new Date(t.doneAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </span>
                    )}
                  </span>
                </div>
              )}
              {editing !== t.id && (
                <div className="todo-actions">
                  {filter === "open" && (
                    <>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label="Move up"
                        disabled={i === 0 || pending}
                        onClick={() => apply(moveTodo(t.id, -1))}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label="Move down"
                        disabled={i === shown.length - 1 || pending}
                        onClick={() => apply(moveTodo(t.id, 1))}
                      >
                        ↓
                      </button>
                    </>
                  )}
                  <button type="button" className="icon-button" aria-label="Edit" onClick={() => setEditing(t.id)}>
                    ✎
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Delete"
                    onClick={() => apply(deleteTodo(t.id))}
                  >
                    ✕
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {done.length > 0 && filter !== "open" && (
        <button
          type="button"
          className="button button-secondary button-small"
          style={{ marginTop: "1rem" }}
          onClick={() => apply(clearOldDone())}
        >
          Clear done tasks older than 30 days
        </button>
      )}
    </>
  );
}
