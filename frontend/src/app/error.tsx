"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="narrow hero">
      <h1>Something went wrong</h1>
      <p className="muted">We couldn&apos;t load this page. The blog API may be unavailable.</p>
      <button className="button" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
