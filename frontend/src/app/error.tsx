"use client";

import { buttonPrimary } from "@/lib/ui";

export default function Error({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="mx-auto max-w-md px-4 py-28 text-center">
      <h1 className="font-serif text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-zinc-500">The server could not be reached. Please try again.</p>
      <button type="button" className={`${buttonPrimary} mt-8`} onClick={() => retry()}>Try again</button>
    </div>
  );
}
