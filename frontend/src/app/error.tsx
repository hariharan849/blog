"use client";

export default function Error({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="text-center py-5">
      <h1 className="h3">Something went wrong</h1>
      <p className="text-muted">The server could not be reached. Please try again.</p>
      <button type="button" className="btn btn-primary" onClick={() => retry()}>Try again</button>
    </div>
  );
}
