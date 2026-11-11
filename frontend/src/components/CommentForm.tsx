"use client";

import { useActionState } from "react";
import { submitComment, type CommentState } from "@/app/posts/[slug]/actions";

const initial: CommentState = { status: "idle" };

export default function CommentForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState(submitComment.bind(null, slug), initial);
  const err = state.status === "error" ? state.errors ?? {} : {};
  const values = state.status === "error" ? state.values : { name: "", email: "", content: "" };

  return (
    <form action={action} className="comment-form" noValidate>
      <h4>Leave a comment</h4>
      <div className="field-row">
        <label>
          Name
          <input name="name" defaultValue={values.name} maxLength={100} required aria-invalid={!!err.name} />
          {err.name && <span className="field-error">{err.name}</span>}
        </label>
        <label>
          <span>
            Email <span className="muted">(not published)</span>
          </span>
          <input name="email" type="email" defaultValue={values.email} required aria-invalid={!!err.email} />
          {err.email && <span className="field-error">{err.email}</span>}
        </label>
      </div>
      <label>
        Comment
        <textarea name="content" defaultValue={values.content} rows={4} maxLength={5000} required aria-invalid={!!err.content} />
        {err.content && <span className="field-error">{err.content}</span>}
      </label>
      {state.status === "error" && state.message && <p className="field-error">{state.message}</p>}
      {state.status === "success" && <p className="success">Thanks! Your comment was posted.</p>}
      <button type="submit" className="button" disabled={pending}>
        {pending ? "Posting…" : "Submit comment"}
      </button>
    </form>
  );
}
