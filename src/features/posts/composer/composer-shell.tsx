"use client";

import { ChevronRight, Eye, SlidersHorizontal, Trash2, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { IconButton, Sheet, cx } from "@/shared/peacock/ui";
import { POSTS_MOBILE_QUERY, useMediaQuery } from "../use-media-query";
import styles from "./composer.module.css";

function openModal(dialog: HTMLDialogElement | null): void {
  if (!dialog || dialog.open) return;
  if (typeof dialog.showModal === "function") {
    try {
      dialog.showModal();
      return;
    } catch {
      // jsdom and partial dialog implementations use the fallback below.
    }
  }
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.dataset.modalFallback = "true";
  dialog.setAttribute("open", "");
}

export function closeModal(dialog: HTMLDialogElement | null): void {
  if (!dialog) return;
  if (typeof dialog.close === "function" && dialog.open) {
    try {
      dialog.close();
      return;
    } catch {
      // Partial dialog implementations use the attribute fallback.
    }
  }
  dialog.removeAttribute("open");
}

export type ComposerShellProps = {
  /** Breadcrumb tail: the post title or "New post". */
  crumb: string;
  saveIndicator: ReactNode;
  previewOpen: boolean;
  onPreviewChange: (open: boolean) => void;
  previewDisabled?: boolean;
  /** Secondary header action, e.g. "Save as idea". */
  secondary?: ReactNode;
  /** The one primary action: Schedule / Update. */
  primary?: ReactNode;
  onRequestClose: () => void;
  closeDisabled?: boolean;
  /** Confirmed deletion is handled by the platform composer. */
  onRequestDelete?: () => void;
  deleteDisabled?: boolean;
  /** Writing column. */
  children: ReactNode;
  /** Right settings panel (340px). */
  settings: ReactNode;
  /** Private discussion replaces settings while it is open. */
  comments?: ReactNode;
  onCommentsClose?: () => void;
  /**
   * Settings actions (Delete, View in calendar). Pinned below the settings
   * so they stay reachable without scrolling, on desktop and in the sheet.
   */
  settingsFooter?: ReactNode;
  /** Feed preview pane; replaces the writing column when previewOpen. */
  preview: ReactNode;
  /** Mobile summary bar text, e.g. "Thu, Oct 29 · 09:00 CET". */
  summary: string;
  /** Full-width overlays such as the unsaved-close warning. */
  overlay?: ReactNode;
  /** Wrap in a form (X composer submits through it). */
  onSubmit?: () => void;
  dialogRef?: React.RefObject<HTMLDialogElement | null>;
};

/**
 * Full-screen Composer sheet over the calendar (SCREENS.md › Composer):
 * header with breadcrumb, save state, Preview, a secondary and the primary
 * action; the writing column; and the 340px settings panel. Preview swaps
 * the writing column for the feed preview; the editor stays mounted (only
 * hidden) so its content and selection survive the round trip. On mobile the
 * settings move into a bottom sheet opened from a summary bar.
 */
export function ComposerShell({
  crumb,
  saveIndicator,
  previewOpen,
  onPreviewChange,
  previewDisabled = false,
  secondary,
  primary,
  onRequestClose,
  closeDisabled = false,
  onRequestDelete,
  deleteDisabled = false,
  children,
  settings,
  comments,
  onCommentsClose,
  settingsFooter,
  preview,
  summary,
  overlay,
  onSubmit,
  dialogRef: externalRef,
}: ComposerShellProps): React.JSX.Element {
  const ownRef = useRef<HTMLDialogElement>(null);
  const dialogRef = externalRef ?? ownRef;
  const titleId = useId();
  const settingsId = useId();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const isMobile = useMediaQuery(POSTS_MOBILE_QUERY);
  const sheetOpen = isMobile && settingsOpen;

  useEffect(() => {
    openModal(dialogRef.current);
  }, [dialogRef]);

  const body = (
    <>
      <header className={styles.header}>
        <IconButton
          aria-label="Close composer"
          icon={<X size={18} strokeWidth={1.75} />}
          disabled={closeDisabled}
          onClick={onRequestClose}
        />
        <nav className={styles.crumbs} aria-label="Breadcrumb">
          <button
            type="button"
            className={styles.crumbParent}
            disabled={closeDisabled}
            onClick={onRequestClose}
          >
            Posts
          </button>
          <ChevronRight size={14} className={styles.crumbSep} aria-hidden />
          <h2 id={titleId} className={styles.crumbTitle}>
            {crumb}
          </h2>
        </nav>
        <span className={styles.headerSpacer} />
        <span className={styles.saveState} aria-live="polite" role="status">
          {saveIndicator}
        </span>
        {onRequestDelete ? (
          <IconButton
            aria-label="Delete post"
            title="Delete post"
            icon={<Trash2 size={16} strokeWidth={1.75} />}
            disabled={deleteDisabled}
            onClick={onRequestDelete}
          />
        ) : null}
        <button
          type="button"
          className={cx(styles.previewToggle)}
          aria-label="Preview"
          title="Preview"
          aria-pressed={previewOpen}
          disabled={previewDisabled}
          onClick={() => onPreviewChange(!previewOpen)}
        >
          <Eye size={15} strokeWidth={1.75} aria-hidden />
          <span className={styles.previewLabel}>Preview</span>
        </button>
        {secondary}
        {primary}
      </header>
      <div className={styles.panes} data-preview={previewOpen || undefined}>
        <main className={styles.editorPane} hidden={previewOpen}>
          <div className={styles.editorColumn}>{children}</div>
        </main>
        {previewOpen ? (
          <div className={styles.previewPane}>{preview}</div>
        ) : null}
        {comments ? (
          <aside
            className={cx(styles.settings, styles.commentsPane)}
            aria-label="Post comments"
          >
            {comments}
          </aside>
        ) : isMobile ? null : (
          <aside
            id={settingsId}
            className={styles.settings}
            aria-label="Post settings"
          >
            <div className={styles.settingsBody}>{settings}</div>
            {settingsFooter ? (
              <div className={styles.footer}>{settingsFooter}</div>
            ) : null}
          </aside>
        )}
      </div>
      {isMobile ? (
        <>
          <button
            type="button"
            className={styles.summaryBar}
            aria-haspopup="dialog"
            aria-expanded={sheetOpen}
            onClick={() => setSettingsOpen(true)}
          >
            <SlidersHorizontal size={15} aria-hidden />
            <span className={styles.summaryText}>{summary}</span>
            <span className={styles.summaryAction}>Settings</span>
          </button>
          <Sheet
            open={sheetOpen}
            onOpenChange={setSettingsOpen}
            side="bottom"
            title="Post settings"
            closeLabel="Close settings"
            bodyClassName={styles.sheetBody}
            footerClassName={styles.sheetFooter}
            footer={settingsFooter}
          >
            {settings}
          </Sheet>
        </>
      ) : null}
      {overlay}
    </>
  );

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (comments && onCommentsClose) onCommentsClose();
        else if (sheetOpen) setSettingsOpen(false);
        else if (!closeDisabled) onRequestClose();
      }}
      onKeyDown={(event) => {
        if (
          event.key === "Escape" &&
          event.currentTarget.dataset.modalFallback === "true"
        ) {
          event.preventDefault();
          if (comments && onCommentsClose) onCommentsClose();
          else if (sheetOpen) setSettingsOpen(false);
          else if (!closeDisabled) onRequestClose();
        }
      }}
    >
      {onSubmit ? (
        <form
          className={styles.frame}
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          {body}
        </form>
      ) : (
        <div className={styles.frame}>{body}</div>
      )}
    </dialog>
  );
}

/** Settings panel section with a 20px pad and a hairline between sections. */
export function SettingsSection({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): React.JSX.Element {
  return <div className={cx(styles.section, className)}>{children}</div>;
}
