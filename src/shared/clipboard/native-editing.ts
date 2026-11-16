"use client";

/**
 * Native copy and paste in the app's own fields.
 *
 * Inside Nebula's desktop shell a miniapp page is hosted, and ⌘C/⌘V arrives as
 * a plain keydown: Chromium's default editing action only runs when the host
 * routes the chord to `webContents.paste()`/`copy()`. Until that ships in a
 * desktop release, the chord reaches this page but nothing happens, which is
 * why the app grew its own Paste buttons in the first place.
 *
 * So the app does the editing itself: when a copy/paste chord is pressed in one
 * of our fields and the browser did not already act on it, we read or write the
 * clipboard and put the text where the caret is. Where the browser does handle
 * it (a normal tab, or a desktop build with the fix), the native path wins and
 * this stays out of the way.
 *
 * Scope: the post copy fields (the ProseMirror editor) and the link inputs
 * plus any other input/textarea/contenteditable the app renders.
 */

const EDITABLE_SELECTOR = [
  "input:not([type=button]):not([type=submit]):not([type=reset]):not([type=checkbox]):not([type=radio]):not([type=file])",
  "textarea",
  "[contenteditable=true]",
  "[contenteditable='']",
  "[role=textbox]",
].join(",");

type Editable = HTMLInputElement | HTMLTextAreaElement | HTMLElement;

function editableAt(node: EventTarget | null): Editable | null {
  if (!(node instanceof HTMLElement)) return null;
  const field = node.closest<HTMLElement>(EDITABLE_SELECTOR);
  if (!field) return null;
  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
    if (field.disabled || field.readOnly) return null;
    return field;
  }
  // `isContentEditable` is undefined in jsdom, so trust the attribute too.
  const editable = field.getAttribute("contenteditable");
  if (editable === "true" || editable === "" || field.isContentEditable) return field;
  return null;
}

/** The selected text in a field, or "" when there is no selection. */
export function selectionText(field: Editable): string {
  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
    const start = field.selectionStart ?? 0;
    const end = field.selectionEnd ?? start;
    return end > start ? field.value.slice(start, end) : "";
  }
  const selection = field.ownerDocument.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return "";
  return selection.toString();
}

/**
 * Puts text into a field the way a paste would: at the caret, replacing the
 * selection, with an input event React's controlled fields and ProseMirror both
 * see.
 */
export function insertText(field: Editable, text: string): void {
  if (!text) return;
  // The caret is already in the field the person is typing in; moving focus
  // would collapse the selection we are about to replace.
  if (field.ownerDocument.activeElement !== field) field.focus();

  if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
    const start = field.selectionStart ?? field.value.length;
    const end = field.selectionEnd ?? start;
    const next = field.value.slice(0, start) + text + field.value.slice(end);
    // Go through the prototype setter so React's value tracker notices the
    // change and calls onChange; a plain `field.value =` is invisible to it.
    const proto =
      field instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    const setValue = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setValue) setValue.call(field, next);
    else field.value = next;
    const caret = start + text.length;
    field.setSelectionRange(caret, caret);
    field.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        data: text,
        inputType: "insertFromPaste",
      }),
    );
    return;
  }

  // A rich-text editor (ProseMirror/TipTap): hand it a real paste event so it
  // keeps its own history, marks and undo stack.
  const data = new DataTransfer();
  data.setData("text/plain", text);
  const pasted = new ClipboardEvent("paste", {
    clipboardData: data,
    bubbles: true,
    cancelable: true,
  });
  field.dispatchEvent(pasted);
  if (pasted.defaultPrevented) return;
  // Plain contenteditable with nothing listening: insert at the selection.
  const selection = field.ownerDocument.getSelection();
  if (selection && selection.rangeCount > 0) {
    selection.deleteFromDocument();
    selection.getRangeAt(0).insertNode(field.ownerDocument.createTextNode(text));
    selection.collapseToEnd();
  } else {
    field.textContent = `${field.textContent ?? ""}${text}`;
  }
  field.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      data: text,
      inputType: "insertFromPaste",
    }),
  );
}

function isCopyOrPaste(event: KeyboardEvent): "copy" | "paste" | null {
  if (!(event.metaKey || event.ctrlKey) || event.altKey) return null;
  const key = event.key.toLowerCase();
  if (key === "v") return "paste";
  if (key === "c") return "copy";
  return null;
}

async function readClipboard(): Promise<string> {
  if (!navigator.clipboard?.readText) return "";
  try {
    return await navigator.clipboard.readText();
  } catch (error) {
    console.warn("[content-calendar] clipboard read failed", error);
    return "";
  }
}

async function writeClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to the selection-based copy
    }
  }
  return false;
}

/** Installs the bridge once per page; returns the teardown. */
export function installNativeEditing(doc: Document = document): () => void {
  let pasted = false;
  let copied = false;

  // Remember whether the browser's own paste ran, so the fallback below only
  // acts when nothing happened. Capture phase, so it is seen before anything
  // downstream can stop it.
  const onPaste = () => {
    pasted = true;
  };
  const onCopy = () => {
    copied = true;
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const chord = isCopyOrPaste(event);
    if (!chord || event.defaultPrevented) return;

    const field = editableAt(event.target);
    if (!field) return;

    if (chord === "copy") {
      const text = selectionText(field);
      if (!text) return;
      // Same shape as paste: give the browser's own copy a chance, and only
      // write the clipboard when nothing else did.
      copied = false;
      window.setTimeout(() => {
        if (copied) return;
        void writeClipboard(text);
      }, 60);
      return;
    }

    // Paste: let the native action have its go first, then check whether the
    // field actually changed. If it did not, the host swallowed it, and we
    // insert the clipboard text ourselves.
    pasted = false;
    const before = field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement
      ? field.value
      : field.innerHTML;
    window.setTimeout(() => {
      if (pasted) return;
      const after = field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement
        ? field.value
        : field.innerHTML;
      if (after !== before) return;
      void readClipboard().then((text) => {
        if (text) insertText(field, text);
      });
    }, 60);
  };

  doc.addEventListener("paste", onPaste, true);
  doc.addEventListener("copy", onCopy, true);
  doc.addEventListener("keydown", onKeyDown, true);
  return () => {
    doc.removeEventListener("paste", onPaste, true);
    doc.removeEventListener("copy", onCopy, true);
    doc.removeEventListener("keydown", onKeyDown, true);
  };
}
