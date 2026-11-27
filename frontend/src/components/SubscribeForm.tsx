"use client";

import { useActionState } from "react";
import { subscribe } from "@/app/daily/actions";

/** Email sign-up for the daily lesson. Double opt-in: the backend emails a confirmation link. */
export default function SubscribeForm({ compact = false }: { compact?: boolean }) {
  const [result, action, pending] = useActionState(subscribe, null);
  return (
    <section id="subscribe" className={`card subscribe${compact ? " subscribe-compact" : ""}`} aria-labelledby="subscribe-title">
      <div className="card-body">
        <h3 id="subscribe-title" className="subscribe-title">
          Get the Daily Dose by email
        </h3>
        <p className="muted subscribe-lead">One short engineering lesson each morning, with a link to the full post.</p>
        {result?.ok ? (
          <p className="success" role="status">
            {result.message}
          </p>
        ) : (
          <form action={action} className="subscribe-form">
            <label className="visually-hidden" htmlFor="subscribe-email">
              Email address
            </label>
            <input
              id="subscribe-email"
              name="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              required
              aria-invalid={result && !result.ok ? true : undefined}
            />
            {/* Honeypot: hidden from people, filled in by bots. */}
            <input name="company" tabIndex={-1} autoComplete="off" className="visually-hidden" aria-hidden="true" />
            <button type="submit" className="button" disabled={pending}>
              {pending ? "Subscribing…" : "Subscribe"}
            </button>
          </form>
        )}
        {result && !result.ok && (
          <p className="field-error" role="alert">
            {result.message}
          </p>
        )}
        <p className="muted small subscribe-note">No spam. Unsubscribe with one click from any email.</p>
      </div>
    </section>
  );
}
