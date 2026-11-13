"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "./cx";
import styles from "./filter-chip.module.css";

export type FilterChipProps = {
  /** Filter name, shown as "Field:" before the value. */
  field: string;
  /** Selected value, e.g. "Hot" or "United States". */
  value: ReactNode;
  onRemove: () => void;
  /**
   * Accessible name of the ✕ button. Defaults to
   * "Remove filter Field: value" when `value` is a string.
   */
  removeLabel?: string;
  disabled?: boolean;
  className?: string;
};

/** Applied filter, "Field: value ✕" (Leads › filter row). */
export function FilterChip({
  field,
  value,
  onRemove,
  removeLabel,
  disabled = false,
  className,
}: FilterChipProps): React.JSX.Element {
  const name =
    removeLabel ??
    (typeof value === "string" || typeof value === "number"
      ? `Remove filter ${field}: ${value}`
      : `Remove ${field} filter`);
  return (
    <span className={cx(styles.chip, className)}>
      <span className={styles.field}>{field}:</span>
      <span className={styles.value}>{value}</span>
      <button
        type="button"
        className={styles.remove}
        aria-label={name}
        disabled={disabled}
        onClick={onRemove}
      >
        <X size={12} strokeWidth={2} aria-hidden />
      </button>
    </span>
  );
}
