"use client";

import { useEffect, useRef } from "react";

/**
 * Giscus comments, stored as GitHub Discussions in this repository. Hidden
 * until NEXT_PUBLIC_GISCUS_REPO_ID and NEXT_PUBLIC_GISCUS_CATEGORY_ID are set
 * (both come from https://giscus.app after enabling Discussions on the repo).
 */
const REPO = process.env.NEXT_PUBLIC_GISCUS_REPO || "hariharan849/blog";
const REPO_ID = process.env.NEXT_PUBLIC_GISCUS_REPO_ID || "";
const CATEGORY = process.env.NEXT_PUBLIC_GISCUS_CATEGORY || "Comments";
const CATEGORY_ID = process.env.NEXT_PUBLIC_GISCUS_CATEGORY_ID || "";

export const commentsEnabled = Boolean(REPO_ID && CATEGORY_ID);

export default function Comments() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!commentsEnabled || !host) return;
    const script = document.createElement("script");
    const attrs: Record<string, string> = {
      src: "https://giscus.app/client.js",
      "data-repo": REPO,
      "data-repo-id": REPO_ID,
      "data-category": CATEGORY,
      "data-category-id": CATEGORY_ID,
      "data-mapping": "pathname",
      "data-strict": "1",
      "data-reactions-enabled": "1",
      "data-emit-metadata": "0",
      "data-input-position": "top",
      "data-theme": "preferred_color_scheme",
      "data-lang": "en",
      "data-loading": "lazy",
      crossorigin: "anonymous",
    };
    for (const [k, v] of Object.entries(attrs)) script.setAttribute(k, v);
    script.async = true;
    host.replaceChildren(script);
    return () => host.replaceChildren();
  }, []);

  if (!commentsEnabled) return null;
  return (
    <section className="comments" aria-label="Comments">
      <h2>Comments</h2>
      <div ref={ref} />
    </section>
  );
}
