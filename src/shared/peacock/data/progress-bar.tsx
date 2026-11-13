import type { ReactNode } from "react";
import { cx } from "../ui/cx";
import styles from "./progress-bar.module.css";

export type ProgressBarProps = {
  /** 0–`max`. Clamped. */
  value: number;
  max?: number;
  /** Visible value text after the bar, e.g. "3.9%" or "202". */
  children?: ReactNode;
  /** Accessible name, usually the column header (e.g. "Engagement rate"). */
  label: string;
  /** Spoken value; defaults to the visible text when it's a string. */
  valueText?: string;
  /**
   * Track width: 56px (default), 64px, or `fluid` to fill the space the
   * parent gives it (the value text keeps its own width).
   */
  width?: 56 | 64 | "fluid";
  className?: string;
};

/** In-table progress bar: 4px tall, 2px radius, value 10px after (COMPONENTS.md › ProgressBar). */
export function ProgressBar({
  value,
  max = 100,
  children,
  label,
  valueText,
  width = 56,
  className,
}: ProgressBarProps): React.JSX.Element {
  const safeMax = max > 0 ? max : 1;
  const clamped = Math.min(Math.max(value, 0), safeMax);
  const pct = (clamped / safeMax) * 100;
  const spoken =
    valueText ?? (typeof children === "string" ? children : undefined);

  return (
    <span
      className={cx(
        styles.root,
        width === "fluid" && styles.fluidRoot,
        className,
      )}
    >
      <span
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuenow={clamped}
        aria-valuetext={spoken}
        className={cx(
          styles.track,
          width === 64 && styles.wide,
          width === "fluid" && styles.fluid,
        )}
      >
        <span className={styles.fill} style={{ width: `${pct}%` }} />
      </span>
      {children !== undefined ? (
        // Already announced through aria-valuetext when it's plain text.
        <span
          className={styles.value}
          aria-hidden={typeof children === "string" ? true : undefined}
        >
          {children}
        </span>
      ) : null}
    </span>
  );
}
