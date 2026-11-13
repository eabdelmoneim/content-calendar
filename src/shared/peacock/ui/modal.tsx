"use client";

import type { KeyboardEvent, ReactNode, RefObject } from "react";
import { useEffect, useEffectEvent, useRef } from "react";
import { cx } from "./cx";
import { focusableIn } from "./focus";
import styles from "./modal.module.css";

export type ModalSurfaceProps = {
  onClose: () => void;
  labelledBy?: string;
  describedBy?: string;
  /** Fallback accessible name when there is no visible title. */
  label?: string;
  /** Element to focus on open; defaults to the first tabbable element. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Close when the overlay is clicked. */
  dismissOnOverlay?: boolean;
  /** Class for the layout wrapper (positions the panel). */
  layoutClassName?: string;
  panelClassName?: string;
  children: ReactNode;
};

/**
 * Modal plumbing for Dialog and Sheet. Uses a native <dialog> opened with
 * showModal(), which makes the rest of the page inert. On top of that we
 * keep a Tab trap, handle Escape ourselves (so jsdom and older engines
 * behave the same) and return focus to the opener on close.
 *
 * Mount only while open; unmounting closes it.
 */
export function ModalSurface({
  onClose,
  labelledBy,
  describedBy,
  label,
  initialFocusRef,
  dismissOnOverlay = true,
  layoutClassName,
  panelClassName,
  children,
}: ModalSurfaceProps): React.JSX.Element {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const focusInitial = useEffectEvent(() => {
    const target = initialFocusRef?.current ?? focusableIn(panelRef.current)[0];
    (target ?? panelRef.current)?.focus();
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    if (typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
    focusInitial();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
      if (typeof dialog.close === "function" && dialog.open) dialog.close();
      opener?.focus();
    };
  }, []);

  function onKeyDown(event: KeyboardEvent<HTMLDialogElement>): void {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const items = focusableIn(panelRef.current);
    if (items.length === 0) {
      event.preventDefault();
      panelRef.current?.focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === panelRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-modal="true"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-label={labelledBy ? undefined : label}
      onKeyDown={onKeyDown}
      // Native Escape fires `cancel`; we close through onClose instead.
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onMouseDown={(event) => {
        if (
          dismissOnOverlay &&
          !panelRef.current?.contains(event.target as Node)
        ) {
          onClose();
        }
      }}
    >
      <div className={cx(styles.layout, layoutClassName)}>
        <div
          ref={panelRef}
          tabIndex={-1}
          className={cx(styles.panel, panelClassName)}
        >
          {children}
        </div>
      </div>
    </dialog>
  );
}
