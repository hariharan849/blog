import type { Metadata } from "next";
import { redirect } from "next/navigation";

import PostEditor from "@/components/PostEditor";
import { apiGet, getCurrentUser } from "@/lib/server-api";
import type { Category } from "@/lib/types";

export const metadata: Metadata = { title: "New post", robots: { index: false } };

export default async function AddPostPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login/?next=/add/");
  if (!user.is_superuser) {
    // Logged in without permission: sending them to /login would bounce straight back here.
    return <div className="alert alert-warning">Only administrators can add posts.</div>;
  }
  const categories = await apiGet<Category[]>("/api/v1/categories/");
  return <PostEditor categories={categories} />;
}
