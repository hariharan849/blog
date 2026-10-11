"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import RichTextEditor from "./RichTextEditor";

import { ApiError, apiRequest } from "@/lib/client-api";
import { BLOGS } from "@/lib/format";
import type { Category, PostDetail } from "@/lib/types";
import { alertError, buttonPrimary, card, cn, input, label } from "@/lib/ui";

export default function PostEditor({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    form.set("content", content);
    form.set("is_published", form.get("is_published") ? "true" : "false");
    if (!(form.get("image") as File | null)?.size) form.delete("image");
    if (!form.get("category")) form.delete("category");
    setBusy(true);
    setError("");
    try {
      const post = await apiRequest<PostDetail>("/api/v1/posts/", "POST", { form });
      router.push(form.get("is_published") === "true" ? `/post/${post.slug}/` : "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the post.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">New post</p>
        <div className="flex items-center gap-4">
          <label htmlFor="is_published" className="flex cursor-pointer items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <input id="is_published" name="is_published" type="checkbox" className="size-4 accent-indigo-600" defaultChecked />
            Publish immediately
          </label>
          <button type="submit" className={buttonPrimary} disabled={busy || !content}>{busy ? "Saving…" : "Save post"}</button>
        </div>
      </div>
      {error && <div className={cn(alertError, "mt-6")} role="alert">{error}</div>}
      <label htmlFor="title" className="sr-only">Title</label>
      <input
        id="title"
        name="title"
        required
        maxLength={200}
        placeholder="Title"
        className="mt-8 w-full bg-transparent font-serif text-4xl font-semibold tracking-tight outline-none placeholder:text-zinc-300 dark:placeholder:text-zinc-700"
      />
      <label htmlFor="excerpt" className="sr-only">Summary</label>
      <textarea
        id="excerpt"
        name="excerpt"
        rows={2}
        placeholder="A one or two sentence summary (optional, used in cards and search)"
        className="mt-3 w-full resize-none bg-transparent text-lg text-zinc-600 outline-none placeholder:text-zinc-300 dark:text-zinc-400 dark:placeholder:text-zinc-700"
      />
      <div className="mt-6">
        <RichTextEditor onChange={setContent} />
      </div>
      <div className={cn(card, "mt-8 grid gap-5 p-6 sm:grid-cols-2")}>
        <div>
          <label htmlFor="blog" className={label}>Blog</label>
          <select id="blog" name="blog" className={input} defaultValue="hariharan">
            {Object.entries(BLOGS).map(([key, blog]) => <option key={key} value={key}>{blog.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="category" className={label}>Category</label>
          <select id="category" name="category" className={input} defaultValue="">
            <option value="">— None —</option>
            {categories.map((category) => <option key={category.slug} value={category.slug}>{category.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="new_category" className={label}>Or new category</label>
          <input id="new_category" name="new_category" className={input} placeholder="e.g. LLMs" />
        </div>
        <div>
          <label htmlFor="tags" className={label}>Tags</label>
          <input id="tags" name="tags" className={input} placeholder="Comma separated, e.g. rag, agents" />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="image" className={label}>Cover image <span className="font-normal text-zinc-500 dark:text-zinc-400">(optional, a gradient is used otherwise)</span></label>
          <input id="image" name="image" type="file" accept="image/*" className={cn(input, "file:mr-3 file:rounded-full file:border-0 file:bg-zinc-100 file:px-3 file:py-1 file:text-sm dark:file:bg-zinc-800")} />
        </div>
      </div>
    </form>
  );
}
