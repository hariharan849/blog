"use client";

import { type ChainedCommands, EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

import { cn } from "@/lib/ui";

interface ToolbarButton {
  label: string;
  title: string;
  run: (chain: ChainedCommands) => void;
  active: [string, Record<string, unknown>?];
}

const BUTTONS: ToolbarButton[] = [
  { label: "B", title: "Bold", run: (c) => c.toggleBold().run(), active: ["bold"] },
  { label: "I", title: "Italic", run: (c) => c.toggleItalic().run(), active: ["italic"] },
  { label: "H2", title: "Heading", run: (c) => c.toggleHeading({ level: 2 }).run(), active: ["heading", { level: 2 }] },
  { label: "H3", title: "Subheading", run: (c) => c.toggleHeading({ level: 3 }).run(), active: ["heading", { level: 3 }] },
  { label: "• List", title: "Bullet list", run: (c) => c.toggleBulletList().run(), active: ["bulletList"] },
  { label: "1. List", title: "Numbered list", run: (c) => c.toggleOrderedList().run(), active: ["orderedList"] },
  { label: "</>", title: "Code block", run: (c) => c.toggleCodeBlock().run(), active: ["codeBlock"] },
  { label: "❝", title: "Quote", run: (c) => c.toggleBlockquote().run(), active: ["blockquote"] },
];

export default function RichTextEditor({ onChange }: { onChange: (html: string) => void }) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: "",
    immediatelyRender: false, // avoid SSR hydration mismatches
    editorProps: { attributes: { class: "editor-surface", "aria-label": "Post content" } },
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? "" : editor.getHTML()),
  });

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/15 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap gap-1 border-b border-zinc-100 bg-zinc-50/80 p-2 dark:border-zinc-800 dark:bg-zinc-900" role="toolbar" aria-label="Formatting">
        {BUTTONS.map((button) => (
          <button
            key={button.title}
            type="button"
            title={button.title}
            aria-label={button.title}
            aria-pressed={!!editor?.isActive(...button.active)}
            className={cn(
              "min-w-8 rounded-lg px-2 py-1 font-mono text-xs transition",
              editor?.isActive(...button.active)
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800",
            )}
            onClick={() => editor && button.run(editor.chain().focus())}
          >
            {button.label}
          </button>
        ))}
      </div>
      <EditorContent editor={editor} className="prose prose-zinc max-w-none dark:prose-invert" />
    </div>
  );
}
