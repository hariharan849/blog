import type { Metadata } from "next";
import { redirect } from "next/navigation";

import PostEditor from "@/components/PostEditor";
import { apiGet, getCurrentUser } from "@/lib/server-api";
import type { Category } from "@/lib/types";
import { alertInfo } from "@/lib/ui";

export const metadata: Metadata = { title: "New post", robots: { index: false } };

export default async function AddPostPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login/?next=/add/");
  if (!user.is_superuser) {
    // Logged in without permission: sending them to /login would bounce straight back here.
    return <div className="mx-auto max-w-xl px-4 py-24"><div className={alertInfo}>Only administrators can add posts.</div></div>;
  }
  const categories = await apiGet<Category[]>("/api/v1/categories/");
  return <PostEditor categories={categories} />;
}
