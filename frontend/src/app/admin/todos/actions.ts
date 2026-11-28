"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { MAX_TEXT, MAX_TODOS, updateTodos, type Todo } from "@/lib/todos";

export type TodoResult = { ok: boolean; message?: string; todos?: Todo[] };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function run(change: (todos: Todo[]) => Todo[]): Promise<TodoResult> {
  try {
    await requireAdmin();
    const todos = await updateTodos(change);
    revalidatePath("/admin/todos");
    return { ok: true, todos };
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") return { ok: false, message: "Please sign in again." };
    console.error(err);
    return { ok: false, message: err instanceof Error ? err.message : "Couldn't save." };
  }
}

const clean = (fields: { text?: string; due?: string; goalId?: string }) => {
  const out: Partial<Todo> = {};
  if (fields.text !== undefined) {
    const text = fields.text.trim().slice(0, MAX_TEXT);
    if (!text) throw new Error("Write something first.");
    out.text = text;
  }
  if (fields.due !== undefined) out.due = DATE_RE.test(fields.due) ? fields.due : undefined;
  if (fields.goalId !== undefined) out.goalId = fields.goalId.slice(0, 80) || undefined;
  return out;
};

export async function addTodo(text: string, due: string, goalId: string): Promise<TodoResult> {
  let fields: Partial<Todo>;
  try {
    fields = clean({ text, due, goalId });
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
  return run((todos) => {
    if (todos.length >= MAX_TODOS) throw new Error(`The list is full (${MAX_TODOS}). Clear some done items.`);
    return [
      {
        id: randomUUID(),
        text: fields.text!,
        due: fields.due,
        goalId: fields.goalId,
        done: false,
        createdAt: new Date().toISOString(),
      },
      ...todos,
    ];
  });
}

export async function editTodo(
  id: string,
  fields: { text?: string; due?: string; goalId?: string },
): Promise<TodoResult> {
  let patch: Partial<Todo>;
  try {
    patch = clean(fields);
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
  return run((todos) => todos.map((t) => (t.id === id ? { ...t, ...patch } : t)));
}

export async function setTodoDone(id: string, done: boolean): Promise<TodoResult> {
  return run((todos) =>
    todos.map((t) => (t.id === id ? { ...t, done, doneAt: done ? new Date().toISOString() : undefined } : t)),
  );
}

export async function moveTodo(id: string, by: -1 | 1): Promise<TodoResult> {
  return run((todos) => {
    const i = todos.findIndex((t) => t.id === id);
    const j = i + by;
    if (i < 0 || j < 0 || j >= todos.length) return todos;
    const next = [...todos];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
}

export async function deleteTodo(id: string): Promise<TodoResult> {
  return run((todos) => todos.filter((t) => t.id !== id));
}

/** Removes done items older than 30 days; recent ones stay for the weekly update. */
export async function clearOldDone(): Promise<TodoResult> {
  const cutoff = new Date(Date.now() - 30 * 86400_000).toISOString();
  return run((todos) => todos.filter((t) => !t.done || (t.doneAt ?? "") >= cutoff));
}
