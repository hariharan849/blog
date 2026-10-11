"use client";

import { useState } from "react";

const link = "text-sm text-zinc-500 transition hover:text-zinc-900 dark:hover:text-white";

export default function ShareLinks({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const encoded = encodeURIComponent(url);

  async function copy() {
    await navigator.clipboard.writeText(url).catch(() => undefined);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Share</p>
      <div className="flex flex-col items-start gap-2">
        <button type="button" onClick={copy} className={link}>{copied ? "Link copied ✓" : "Copy link"}</button>
        <a className={link} target="_blank" rel="noopener noreferrer" href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encoded}`}>
          Share on X
        </a>
        <a className={link} target="_blank" rel="noopener noreferrer" href={`https://www.linkedin.com/shareArticle?mini=true&url=${encoded}`}>
          Share on LinkedIn
        </a>
      </div>
    </div>
  );
}
