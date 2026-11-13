"use client";

import { EditorContent, useEditor, useEditorState, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, ImagePlus, Italic, List, ListOrdered, Redo2, Strikethrough, Undo2 } from "lucide-react";
import { useEffect } from "react";
import styles from "./editor.module.css";

function inlineText(node: JSONContent): string {
  return (node.content ?? [])
    .map((child) => (child.type === "text" ? (child.text ?? "") : child.type === "hardBreak" ? "\n" : inlineText(child)))
    .join("");
}

function listItemText(item: JSONContent, prefix: string): string {
  const [first, ...rest] = item.content ?? [];
  const head = `${prefix}${first ? inlineText(first) : ""}`;
  return rest.length === 0 ? head : `${head}\n${rest.map(blockText).join("\n\n")}`;
}

function blockText(node: JSONContent): string {
  switch (node.type) {
    case "bulletList":
      return (node.content ?? []).map((item) => listItemText(item, "• ")).join("\n");
    case "orderedList": {
      const start = typeof node.attrs?.start === "number" ? node.attrs.start : 1;
      return (node.content ?? []).map((item, index) => listItemText(item, `${start + index}. `)).join("\n");
    }
    case "blockquote":
      return (node.content ?? []).map(blockText).join("\n\n");
    default:
      return inlineText(node);
  }
}

/**
 * The plain text that goes into the share link (Peacock's content
 * projection): paragraphs become blank-line separated, Shift+Enter line
 * breaks become newlines, list items get "• " / "1. " prefixes.
 */
export function projectText(doc: JSONContent): string {
  return (doc.content ?? []).map(blockText).join("\n\n").trim();
}

/** Plain text (older posts, imports) as editor HTML: one paragraph per line. */
export function textToHtml(text: string): string {
  const escape = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return text
    .split(/\n{2,}/)
    .map((block) => `<p>${escape(block).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export type PostEditorProps = {
  /** Initial HTML; the editor owns the content after mount. */
  initialHtml: string;
  disabled?: boolean;
  describedBy?: string;
  onChange: (html: string, text: string) => void;
  onAddImage?: () => void;
  imagesDisabled?: boolean;
};

/** TipTap editor with Peacock's formatting toolbar (workspace/post-editor-content). */
export function PostEditor({
  initialHtml,
  disabled = false,
  describedBy,
  onChange,
  onAddImage,
  imagesDisabled = false,
}: PostEditorProps): React.JSX.Element {
  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    content: initialHtml || "<p></p>",
    extensions: [
      StarterKit.configure({
        heading: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        underline: false,
        link: false,
      }),
    ],
    editorProps: {
      attributes: {
        class: styles.editorProse,
        role: "textbox",
        "aria-label": "Post content",
        "aria-multiline": "true",
        "aria-placeholder": "What do you want to say?",
        ...(describedBy ? { "aria-describedby": describedBy } : {}),
      },
    },
    onUpdate: ({ editor: current }) => {
      onChange(current.getHTML(), projectText(current.getJSON()));
    },
  });

  const active = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current?.isActive("bold") ?? false,
      italic: current?.isActive("italic") ?? false,
      strike: current?.isActive("strike") ?? false,
      bulletList: current?.isActive("bulletList") ?? false,
      orderedList: current?.isActive("orderedList") ?? false,
    }),
  });

  useEffect(() => {
    // Changing editability is setup, not a user edit.
    editor?.setEditable(!disabled, false);
  }, [disabled, editor]);

  return (
    <div className={styles.editorShell}>
      {disabled ? null : (
      <div className={styles.formatToolbar} role="toolbar" aria-label="Post formatting">
        <button
          type="button"
          disabled={disabled || !editor}
          onClick={() => editor?.chain().focus().setParagraph().run()}
        >
          Paragraph
        </button>
        {[
          { label: "Bold", Icon: Bold, pressed: active?.bold, run: () => editor?.chain().focus().toggleBold().run() },
          {
            label: "Italic",
            Icon: Italic,
            pressed: active?.italic,
            run: () => editor?.chain().focus().toggleItalic().run(),
          },
          {
            label: "Strikethrough",
            Icon: Strikethrough,
            pressed: active?.strike,
            run: () => editor?.chain().focus().toggleStrike().run(),
          },
          {
            label: "Bullet list",
            Icon: List,
            pressed: active?.bulletList,
            run: () => editor?.chain().focus().toggleBulletList().run(),
          },
          {
            label: "Numbered list",
            Icon: ListOrdered,
            pressed: active?.orderedList,
            run: () => editor?.chain().focus().toggleOrderedList().run(),
          },
        ].map(({ label, Icon, pressed, run }) => (
          <button
            key={label}
            type="button"
            aria-label={label}
            title={label}
            aria-pressed={pressed ?? false}
            disabled={disabled || !editor}
            onClick={run}
          >
            <Icon size={15} aria-hidden />
          </button>
        ))}
        <span className={styles.toolbarDivider} aria-hidden />
        <button
          type="button"
          aria-label="Undo"
          title="Undo"
          disabled={disabled || !editor}
          onClick={() => editor?.chain().focus().undo().run()}
        >
          <Undo2 size={15} aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Redo"
          title="Redo"
          disabled={disabled || !editor}
          onClick={() => editor?.chain().focus().redo().run()}
        >
          <Redo2 size={15} aria-hidden />
        </button>
        {onAddImage ? (
          <button
            type="button"
            aria-label="Add image"
            title="Add image"
            disabled={disabled || imagesDisabled}
            onClick={onAddImage}
          >
            <ImagePlus size={15} aria-hidden />
          </button>
        ) : null}
      </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
