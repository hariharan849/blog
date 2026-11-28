import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/auth";
import { kvConfigured } from "@/lib/kv";
import { getRoadmap } from "@/lib/roadmap";
import { getTodos, type Todo } from "@/lib/todos";
import AdminTabs from "../AdminTabs";
import TodoList from "./TodoList";

export const metadata: Metadata = { title: "Todos", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminTodosPage() {
  if (!(await getAdmin())) redirect("/admin");

  let todos: Todo[] = [];
  let loadError = "";
  if (kvConfigured) {
    try {
      todos = await getTodos();
    } catch (err) {
      console.error(err);
      loadError = "Couldn't reach Upstash Redis. Check the integration in Vercel.";
    }
  }
  const goals = getRoadmap()
    .goals.filter((g) => g.status !== "done")
    .map((g) => ({ id: g.id, title: g.title }));

  return (
    <div className="narrow admin">
      <section className="hero">
        <AdminTabs current="/admin/todos" />
        <h1>Todos</h1>
        <p className="muted">Private: only you can see this list. Ticked-off tasks feed the weekly progress draft.</p>
        {!kvConfigured && (
          <p className="field-error small">
            Connect storage first: in Vercel, open the project&apos;s Storage tab, add{" "}
            <strong>Upstash for Redis</strong> (free plan) and connect it to this project, then redeploy.
          </p>
        )}
        {loadError && <p className="field-error small">{loadError}</p>}
      </section>
      {kvConfigured && !loadError && <TodoList initial={todos} goals={goals} />}
    </div>
  );
}
