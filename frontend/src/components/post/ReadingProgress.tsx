"use client";

import { useEffect, useState } from "react";

/** Thin bar at the top of the window showing how far through the article the reader is. */
export default function ReadingProgress({ targetId }: { targetId: string }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = target.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const value = total <= 0 ? (rect.top < 0 ? 1 : 0) : Math.min(1, Math.max(0, -rect.top / total));
      setProgress(value);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [targetId]);

  return (
    <div
      className="fixed inset-x-0 top-0 z-50 h-0.5 origin-left bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500"
      style={{ transform: `scaleX(${progress})` }}
      role="progressbar"
      aria-label="Reading progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
    />
  );
}
