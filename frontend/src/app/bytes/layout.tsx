import type { Metadata } from "next";
import { redirect } from "next/navigation";

import BytesNav from "@/components/bytes/BytesNav";
import { getCurrentUser } from "@/lib/server-api";
import { alertInfo, cn, container } from "@/lib/ui";

export const metadata: Metadata = { title: { default: "Daily Bytes", template: "%s · Daily Bytes" }, robots: { index: false } };

export default async function BytesLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login/?next=/bytes/");
  if (!user.is_staff) {
    // Logged in but not staff: sending them to /login would bounce straight back here.
    return (
      <div className="mx-auto max-w-xl px-4 py-24">
        <div className={alertInfo}>Daily Bytes is only available to staff accounts.</div>
      </div>
    );
  }
  return (
    <div className={cn(container, "max-w-5xl py-10")}>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">Private · learning feed</p>
          <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight">Daily Bytes</h1>
        </div>
        <BytesNav />
      </div>
      {children}
    </div>
  );
}
