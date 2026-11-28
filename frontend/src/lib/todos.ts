import "server-only";
import { kv, KEY_PREFIX } from "./kv";

/** Private todo list for /admin/todos, stored as one JSON value in Upstash Redis. */
export type Todo = {
  id: string;
  text: string;
  done: boolean;
  /** YYYY-MM-DD */
  due?: string;
  /** Roadmap goal id this task moves forward. */
  goalId?: string;
  createdAt: string;
  doneAt?: string;
};

const KEY = `${KEY_PREFIX}todos`;
export const MAX_TODOS = 500;
export const MAX_TEXT = 280;

export async function getTodos(): Promise<Todo[]> {
  const value = await kv().get<Todo[]>(KEY);
  return Array.isArray(value) ? value : [];
}

/** Applies `change` to the stored list and saves it. Single-user admin, so last write wins. */
export async function updateTodos(change: (todos: Todo[]) => Todo[]): Promise<Todo[]> {
  const next = change(await getTodos()).slice(0, MAX_TODOS);
  await kv().set(KEY, next);
  return next;
}

/** Todos ticked off in [from, to). */
export async function todosDoneBetween(from: Date, to: Date): Promise<Todo[]> {
  return (await getTodos()).filter(
    (t) => t.done && t.doneAt && t.doneAt >= from.toISOString() && t.doneAt < to.toISOString(),
  );
}
