"use client";

import { useEffect } from "react";

const BUTTON_CLASS =
  "absolute right-2 top-2 rounded-md border border-white/10 bg-white/10 px-2 py-1 font-sans text-xs text-zinc-200 " +
  "opacity-0 backdrop-blur transition hover:bg-white/20 focus:opacity-100 group-hover:opacity-100";

/** Adds a "Copy" button to every code block inside the given container. */
export default function CodeCopy({ containerId }: { containerId: string }) {
  useEffect(() => {
    const container = document.getElementById(containerId);
    if (!container) return;
    const added: HTMLButtonElement[] = [];
    container.querySelectorAll("pre").forEach((pre) => {
      pre.classList.add("group", "relative");
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Copy";
      button.className = BUTTON_CLASS;
      button.setAttribute("aria-label", "Copy code");
      button.addEventListener("click", async () => {
        const code = pre.querySelector("code")?.textContent ?? pre.textContent ?? "";
        try {
          await navigator.clipboard.writeText(code);
          button.textContent = "Copied";
        } catch {
          button.textContent = "Press Ctrl+C";
        }
        window.setTimeout(() => (button.textContent = "Copy"), 1600);
      });
      pre.appendChild(button);
      added.push(button);
    });
    return () => added.forEach((button) => button.remove());
  }, [containerId]);

  return null;
}
