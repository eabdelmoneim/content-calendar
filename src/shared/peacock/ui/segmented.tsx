"use client";

import type { ReactNode } from "react";
import { useRef } from "react";
import { cx } from "./cx";
import { focusValue, nextRovingValue } from "./roving";
import styles from "./segmented.module.css";

export type SegmentedOption<T extends string = string> = {
  value: T;
  label: ReactNode;
  /** Leading lucide icon (12–14px), decorative; the label names the option. */
  icon?: ReactNode;
  /** Disabled options are skipped by arrow keys and cannot be clicked. */
  disabled?: boolean;
  /** Needed when `label` is not plain text (e.g. icon-only options). */
  ariaLabel?: string;
};

export type SegmentedProps<T extends string = string> = {
  /** Accessible name of the group, e.g. "Calendar view". */
  label: string;
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "md" | "compact";
  /** Fill the parent's width with equal-width options (drawer stage picker). */
  block?: boolean;
  className?: string;
};

/** Segmented control (radiogroup). Arrow keys move and select. */
export function Segmented<T extends string = string>({
  label,
  options,
  value,
  onChange,
  size = "md",
  block = false,
  className,
}: SegmentedProps<T>): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label={label}
      className={cx(
        styles.track,
        size === "compact" && styles.compact,
        block && styles.block,
        className,
      )}
      onKeyDown={(event) => {
        const next = nextRovingValue(event, options, value);
        if (next !== null && next !== value) {
          onChange(next as T);
          focusValue(ref.current, next);
        }
      }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.ariaLabel}
            data-value={option.value}
            tabIndex={selected ? 0 : -1}
            disabled={option.disabled}
            className={cx(styles.item, selected && styles.selected)}
            onClick={() => onChange(option.value)}
          >
            {option.icon ? (
              <span className={styles.icon} aria-hidden>
                {option.icon}
              </span>
            ) : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
