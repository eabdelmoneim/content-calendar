"use client";

import type { ReactNode, RefObject } from "react";
import { useId } from "react";
import styles from "./dialog.module.css";
import { ModalSurface } from "./modal";

export type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  /** Body copy, 13px --fg-muted. */
  description?: ReactNode;
  /** Right-aligned actions: Cancel (secondary) plus one primary or danger. */
  actions?: ReactNode;
  children?: ReactNode;
  size?: "sm" | "md";
  initialFocusRef?: RefObject<HTMLElement | null>;
};

/**
 * Confirmation / form dialog (COMPONENTS.md › Dialog). Focus is trapped,
 * Escape and the overlay close it, and focus returns to the opener.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  actions,
  children,
  size = "sm",
  initialFocusRef,
}: DialogProps): React.JSX.Element | null {
  const titleId = useId();
  const descriptionId = useId();
  if (!open) return null;

  return (
    <ModalSurface
      onClose={() => onOpenChange(false)}
      labelledBy={titleId}
      describedBy={description ? descriptionId : undefined}
      initialFocusRef={initialFocusRef}
      layoutClassName={styles.layout}
      panelClassName={
        size === "md" ? `${styles.panel} ${styles.md}` : styles.panel
      }
    >
      <h2 id={titleId} className={styles.title}>
        {title}
      </h2>
      {description ? (
        <p id={descriptionId} className={styles.description}>
          {description}
        </p>
      ) : null}
      {children}
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </ModalSurface>
  );
}
