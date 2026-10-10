"use client";

import { type ChainedCommands, EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

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
    <div className="border rounded bg-white">
      <div className="btn-toolbar border-bottom p-2 gap-1" role="toolbar" aria-label="Formatting">
        {BUTTONS.map((button) => (
          <button
            key={button.title}
            type="button"
            title={button.title}
            className={`btn btn-sm ${editor?.isActive(...button.active) ? "btn-secondary" : "btn-outline-secondary"}`}
            onClick={() => editor && button.run(editor.chain().focus())}
          >
            {button.label}
          </button>
        ))}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
