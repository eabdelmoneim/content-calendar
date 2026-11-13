"use client";

import { ClipboardPaste } from "lucide-react";

import { Button } from "@/shared/peacock/ui";

/**
 * Fills a field from the clipboard. Nebula's desktop app doesn't pass ⌘V or a
 * right-click Paste through to mini app pages yet, so this is the reliable way
 * to get a copied link in there. The desktop app asks once to allow it.
 */
export function PasteButton({
  disabled,
  compact = false,
  onPaste,
  onError,
}: {
  disabled?: boolean;
  /** Icon only, for tight rows; still labelled "Paste" for screen readers. */
  compact?: boolean;
  onPaste: (text: string) => void;
  onError: (message: string) => void;
}): React.JSX.Element {
  return (
    <Button
      size="sm"
      type="button"
      icon={<ClipboardPaste size={13} aria-hidden />}
      disabled={disabled}
      aria-label={compact ? "Paste" : undefined}
      title="Paste from the clipboard"
      onClick={() => {
        if (!navigator.clipboard?.readText) {
          onError("This window can't read the clipboard. Type the link instead.");
          return;
        }
        navigator.clipboard.readText().then(
          (text) => {
            const trimmed = text.trim();
            if (trimmed) onPaste(trimmed);
            else onError("The clipboard has no text. Copy the post's link first.");
          },
          (error: unknown) => {
            console.warn("[content-calendar] clipboard read failed", error);
            onError("Couldn't read the clipboard. Allow clipboard access when asked, then press Paste again.");
          },
        );
      }}
    >
      {compact ? null : "Paste"}
    </Button>
  );
}
