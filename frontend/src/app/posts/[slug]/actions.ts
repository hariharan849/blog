"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/lib/api";

export type CommentValues = { name: string; email: string; content: string };

export type CommentState =
  | { status: "idle" }
  | { status: "success" }
  // `values` echoes the submission back: React resets the form after an action,
  // so the fields use these as defaults to keep the user's input on errors.
  | { status: "error"; values: CommentValues; message?: string; errors?: Record<string, string> };

export async function submitComment(
  slug: string,
  _prev: CommentState,
  formData: FormData,
): Promise<CommentState> {
  const body: CommentValues = {
    name: String(formData.get("name") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    content: String(formData.get("content") ?? "").trim(),
  };

  try {
    const res = await api.addComment(slug, body);
    if (res.ok) {
      revalidatePath(`/posts/${slug}`);
      return { status: "success" };
    }
    const data = res.data as { errors?: Record<string, string>; error?: string };
    return { status: "error", values: body, errors: data.errors, message: data.error };
  } catch {
    return { status: "error", values: body, message: "Could not post your comment. Please try again." };
  }
}
