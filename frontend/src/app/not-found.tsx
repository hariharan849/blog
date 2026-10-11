import Link from "next/link";

import { buttonPrimary } from "@/lib/ui";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-28 text-center">
      <p className="font-serif text-7xl font-semibold text-zinc-200 dark:text-zinc-800">404</p>
      <h1 className="mt-4 font-serif text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-zinc-500">The page you&apos;re looking for doesn&apos;t exist or was moved.</p>
      <Link href="/" className={`${buttonPrimary} mt-8`}>Back to all posts</Link>
    </div>
  );
}
