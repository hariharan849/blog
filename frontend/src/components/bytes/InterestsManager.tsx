"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ApiError, apiRequest } from "@/lib/client-api";
import type { Interest } from "@/lib/types";
import { buttonPrimary, card, cn, input } from "@/lib/ui";

export default function InterestsManager({ interests }: { interests: Interest[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [weight, setWeight] = useState(3);
  const [error, setError] = useState("");

  async function add(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await apiRequest("/api/v1/bytes/interests/", "POST", { json: { name, weight } });
      setName("");
      setWeight(3);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add the interest.");
    }
  }

  async function remove(interest: Interest) {
    await apiRequest(`/api/v1/bytes/interests/${interest.id}/`, "DELETE");
    router.refresh();
  }

  return (
    <section aria-labelledby="interests-heading" className="space-y-5">
      <div>
        <h2 id="interests-heading" className="font-serif text-xl font-semibold">Learning interests</h2>
        <p className="mt-1 text-sm text-zinc-500">They drive each article&apos;s relevance score (1 = mild, 5 = top priority).</p>
      </div>
      <form onSubmit={add} className={cn(card, "space-y-3 p-5")}>
        <div className="flex gap-2">
          <input className={input} placeholder="e.g. LLM agents" aria-label="Interest" value={name} required
            onChange={(event) => setName(event.target.value)} />
          <input className={cn(input, "w-20")} type="number" min={1} max={5} aria-label="Priority" value={weight}
            onChange={(event) => setWeight(Number(event.target.value))} />
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button className={buttonPrimary} type="submit">Add</button>
      </form>
      <ul className="flex flex-wrap gap-2">
        {interests.length ? (
          interests.map((interest) => (
            <li key={interest.id} className="group flex items-center gap-2 rounded-full border border-zinc-200 py-1 pl-3 pr-1 text-sm dark:border-zinc-800">
              <span>{interest.name}</span>
              <span aria-label={`Priority ${interest.weight}`} className="flex gap-0.5">
                {Array.from({ length: 5 }, (_, i) => (
                  <span key={i} className={cn("size-1.5 rounded-full", i < interest.weight ? "bg-indigo-500" : "bg-zinc-200 dark:bg-zinc-700")} />
                ))}
              </span>
              <button type="button" onClick={() => remove(interest)} aria-label={`Remove ${interest.name}`}
                className="grid size-6 place-items-center rounded-full text-zinc-500 dark:text-zinc-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40">
                ×
              </button>
            </li>
          ))
        ) : (
          <li className="text-sm text-zinc-500">No interests yet; every article scores as neutral.</li>
        )}
      </ul>
    </section>
  );
}
