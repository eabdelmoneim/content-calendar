import { LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { forwardRef } from "react";
import styles from "./button.module.css";
import { cx, ICON_STROKE } from "./cx";

export type ButtonVariant =
  "primary" | "secondary" | "ghost" | "danger" | "destructive-secondary";
export type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Spinner replaces the leading icon and the button is disabled. */
  loading?: boolean;
  /** Label while loading, e.g. "Scheduling…". Width holds at the wider label. */
  loadingLabel?: ReactNode;
  /** Leading lucide icon (sized to 14px by CSS). */
  icon?: ReactNode;
  iconRight?: ReactNode;
};

/**
 * Peacock button (COMPONENTS.md › Button). One primary per view. `danger` is
 * for confirmation dialogs only; elsewhere use `destructive-secondary`.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "secondary",
      size = "md",
      loading = false,
      loadingLabel,
      disabled = false,
      icon,
      iconRight,
      className,
      children,
      type = "button",
      ...rest
    },
    ref,
  ) {
    const leading = loading ? (
      <LoaderCircle
        className={styles.spinner}
        size={14}
        strokeWidth={ICON_STROKE}
      />
    ) : (
      icon
    );

    return (
      <button
        ref={ref}
        type={type}
        className={cx(styles.button, styles[size], styles[variant], className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...rest}
      >
        {leading ? (
          <span className={styles.icon} aria-hidden>
            {leading}
          </span>
        ) : null}
        {loadingLabel !== undefined ? (
          <span className={styles.swap}>
            <span
              className={loading ? styles.hidden : undefined}
              aria-hidden={loading || undefined}
            >
              {children}
            </span>
            <span
              className={loading ? undefined : styles.hidden}
              aria-hidden={!loading || undefined}
            >
              {loadingLabel}
            </span>
          </span>
        ) : (
          children
        )}
        {iconRight ? (
          <span className={styles.icon} aria-hidden>
            {iconRight}
          </span>
        ) : null}
      </button>
    );
  },
);
