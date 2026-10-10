import type { Metadata } from "next";
import { redirect } from "next/navigation";

import BytesNav from "@/components/bytes/BytesNav";
import { getCurrentUser } from "@/lib/server-api";

export const metadata: Metadata = { title: { default: "Daily Bytes", template: "%s · Daily Bytes" }, robots: { index: false } };

export default async function BytesLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login/?next=/bytes/");
  if (!user.is_staff) {
    // Logged in but not staff: sending them to /login would bounce straight back here.
    return <div className="alert alert-warning">Daily Bytes is only available to staff accounts.</div>;
  }
  return (
    <>
      <BytesNav />
      {children}
    </>
  );
}
