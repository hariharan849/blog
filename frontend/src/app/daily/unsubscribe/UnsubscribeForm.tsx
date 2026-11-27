"use client";

import { useActionState } from "react";
import { unsubscribe } from "../actions";

/** A button rather than unsubscribing on page load, so link scanners in mail apps can't unsubscribe people. */
export default function UnsubscribeForm({ id, token }: { id: string; token: string }) {
  const [result, action, pending] = useActionState(unsubscribe, null);
  if (result) {
    return (
      <p className={result.ok ? "success" : "field-error"} role="status">
        {result.message}
      </p>
    );
  }
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="token" value={token} />
      <button type="submit" className="button" disabled={pending}>
        {pending ? "Unsubscribing…" : "Unsubscribe me"}
      </button>
    </form>
  );
}
