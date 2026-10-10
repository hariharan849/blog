"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import RichTextEditor from "./RichTextEditor";

import { ApiError, apiRequest } from "@/lib/client-api";
import { BLOGS } from "@/lib/format";
import type { Category, PostDetail } from "@/lib/types";

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
    <div className="card shadow-sm">
      <div className="card-body p-4">
        <h1 className="h3 mb-4">Create a new post</h1>
        {error && <div className="alert alert-danger">{error}</div>}
        <form onSubmit={submit}>
          <div className="mb-3">
            <label htmlFor="title" className="form-label">Title</label>
            <input id="title" name="title" className="form-control" required maxLength={200} />
          </div>
          <div className="row">
            <div className="col-md-4 mb-3">
              <label htmlFor="blog" className="form-label">Blog</label>
              <select id="blog" name="blog" className="form-select" defaultValue="hariharan">
                {Object.entries(BLOGS).map(([key, blog]) => <option key={key} value={key}>{blog.label}</option>)}
              </select>
            </div>
            <div className="col-md-4 mb-3">
              <label htmlFor="category" className="form-label">Category</label>
              <select id="category" name="category" className="form-select" defaultValue="">
                <option value="">— None —</option>
                {categories.map((category) => <option key={category.slug} value={category.slug}>{category.name}</option>)}
              </select>
            </div>
            <div className="col-md-4 mb-3">
              <label htmlFor="new_category" className="form-label">Or new category</label>
              <input id="new_category" name="new_category" className="form-control" placeholder="e.g. LLMs" />
            </div>
          </div>
          <div className="mb-3">
            <label htmlFor="excerpt" className="form-label">Summary <span className="text-muted">(optional)</span></label>
            <textarea id="excerpt" name="excerpt" className="form-control" rows={2} />
          </div>
          <div className="mb-3">
            <span className="form-label d-block">Content</span>
            <RichTextEditor onChange={setContent} />
          </div>
          <div className="row">
            <div className="col-md-6 mb-3">
              <label htmlFor="tags" className="form-label">Tags</label>
              <input id="tags" name="tags" className="form-control" placeholder="Comma separated, e.g. rag, agents" />
            </div>
            <div className="col-md-6 mb-3">
              <label htmlFor="image" className="form-label">Image</label>
              <input id="image" name="image" type="file" accept="image/*" className="form-control" />
            </div>
          </div>
          <div className="form-check mb-3">
            <input id="is_published" name="is_published" type="checkbox" className="form-check-input" defaultChecked />
            <label htmlFor="is_published" className="form-check-label">Publish immediately</label>
          </div>
          <button type="submit" className="btn btn-primary" disabled={busy || !content}>
            {busy ? "Saving…" : "Save post"}
          </button>
        </form>
      </div>
    </div>
  );
}
