"use client";

import { X } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { forwardRef } from "react";
import styles from "./bulk-bar.module.css";
import { cx } from "./cx";

export type BulkBarProps = {
  /** Selection summary, e.g. "3 selected" or "All 1,240 selected". */
  summary: ReactNode;
  /** BulkBarButton actions (Popover triggers work too). */
  children: ReactNode;
  /** Shows the trailing ✕ that clears the selection. */
  onClear?: () => void;
  clearLabel?: string;
  /** Accessible name of the action group. */
  label?: string;
  /**
   * The selection is being re-read (e.g. a new result set is loading). Marks
   * the bar busy; callers also disable their action buttons.
   */
  busy?: boolean;
  /**
   * `floating`: centred over the bottom of the nearest positioned ancestor
   * (the table card). `inline`: sits in normal flow, e.g. in a toolbar row.
   */
  placement?: "floating" | "inline";
  className?: string;
};

/**
 * Inverse selection action bar (Leads › bulk actions). Render it only while
 * something is selected; the summary is announced politely as it changes.
 * A named `group`, not a `toolbar`: its few buttons stay in the Tab order, so
 * it needs no arrow-key roving focus.
 */
export function BulkBar({
  summary,
  children,
  onClear,
  clearLabel = "Clear selection",
  label = "Bulk actions",
  placement = "floating",
  busy = false,
  className,
}: BulkBarProps): React.JSX.Element {
  return (
    <div
      role="group"
      aria-label={label}
      aria-busy={busy || undefined}
      className={cx(styles.bar, styles[placement], className)}
    >
      <span className={styles.summary} aria-live="polite">
        {summary}
      </span>
      {children}
      {onClear ? (
        <>
          <span className={styles.divider} aria-hidden />
          <button
            type="button"
            className={cx(styles.button, styles.clear)}
            aria-label={clearLabel}
            onClick={onClear}
          >
            <X size={14} strokeWidth={2} aria-hidden />
          </button>
        </>
      ) : null}
    </div>
  );
}

export type BulkBarButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** `primary` for the one main action (Add to Leads). */
  variant?: "primary" | "ghost";
  /** Leading lucide icon, 14px. */
  icon?: ReactNode;
};

/** 30px action inside a BulkBar. Forwards its ref so it can be a Popover trigger. */
export const BulkBarButton = forwardRef<HTMLButtonElement, BulkBarButtonProps>(
  function BulkBarButton(
    { variant = "ghost", icon, className, children, type = "button", ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cx(styles.button, styles[variant], className)}
        {...rest}
      >
        {icon ? (
          <span className={styles.icon} aria-hidden>
            {icon}
          </span>
        ) : null}
        {children}
      </button>
    );
  },
);
