"use client";

import { useEffect, useState } from "react";

/** Thin bar along the top of the window that fills as the reader scrolls through the article. */
export default function ReadingProgress({ target = "article" }: { target?: string }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = document.querySelector(target);
    if (!el) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const { top, height } = el.getBoundingClientRect();
      const total = height - window.innerHeight;
      setProgress(total <= 0 ? 1 : Math.min(1, Math.max(0, -top / total)));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [target]);

  return (
    <div className="reading-progress" aria-hidden="true">
      <div className="reading-progress-bar" style={{ transform: `scaleX(${progress})` }} />
    </div>
  );
}
