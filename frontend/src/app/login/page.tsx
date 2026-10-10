import type { Metadata } from "next";
import { redirect } from "next/navigation";

import AuthForm from "@/components/AuthForm";
import { safeNext } from "@/lib/safe-next";
import { getCurrentUser } from "@/lib/server-api";

export const metadata: Metadata = { title: "Login", robots: { index: false } };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const next = safeNext((await searchParams).next);
  if (await getCurrentUser()) redirect(next);
  return <AuthForm mode="login" next={next} />;
}
