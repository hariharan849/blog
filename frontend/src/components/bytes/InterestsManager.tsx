"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ApiError, apiRequest } from "@/lib/client-api";
import type { Interest } from "@/lib/types";

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
    <>
      <h2 className="h4">Your learning interests</h2>
      <p className="text-muted small">Used to score how relevant each article is (1 = mild, 5 = top priority).</p>
      <form onSubmit={add} className="row g-2 mb-3">
        <div className="col-7">
          <input className="form-control" placeholder="e.g. LLM agents" aria-label="Interest" value={name} required
            onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="col-3">
          <input className="form-control" type="number" min={1} max={5} aria-label="Priority" value={weight}
            onChange={(event) => setWeight(Number(event.target.value))} />
        </div>
        <div className="col-2">
          <button className="btn btn-primary w-100" type="submit">Add</button>
        </div>
        {error && <div className="text-danger small">{error}</div>}
      </form>
      <ul className="list-group">
        {interests.length ? (
          interests.map((interest) => (
            <li className="list-group-item d-flex justify-content-between align-items-center" key={interest.id}>
              <span>{interest.name} <span className="badge bg-secondary">{interest.weight}</span></span>
              <button type="button" className="btn btn-sm btn-link text-danger" onClick={() => remove(interest)}>Remove</button>
            </li>
          ))
        ) : (
          <li className="list-group-item text-muted">No interests yet; every article scores as neutral.</li>
        )}
      </ul>
    </>
  );
}
