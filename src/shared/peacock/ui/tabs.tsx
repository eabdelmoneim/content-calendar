"use client";

import type { ReactNode } from "react";
import { useId, useRef } from "react";
import { cx } from "./cx";
import { focusValue, nextRovingValue } from "./roving";
import styles from "./tabs.module.css";

export type TabItem<T extends string = string> = {
  value: T;
  label: ReactNode;
  disabled?: boolean;
  /** id of the tabpanel this tab controls, when rendered on the same page. */
  panelId?: string;
};

export type TabsProps<T extends string = string> = {
  /** Accessible name of the tablist, e.g. "Posts views". */
  label: string;
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
};

/**
 * Underline page tabs (COMPONENTS.md › Tabs). Automatic activation: arrow
 * keys, Home and End move focus and selection together.
 */
export function Tabs<T extends string = string>({
  label,
  items,
  value,
  onChange,
  className,
}: TabsProps<T>): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const idPrefix = useId();

  return (
    <div
      ref={ref}
      role="tablist"
      aria-label={label}
      aria-orientation="horizontal"
      className={cx(styles.list, className)}
      onKeyDown={(event) => {
        const next = nextRovingValue(event, items, value, "horizontal");
        if (next !== null && next !== value) {
          onChange(next as T);
          focusValue(ref.current, next);
        }
      }}
    >
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            id={`${idPrefix}-${item.value}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={item.panelId}
            data-value={item.value}
            tabIndex={selected ? 0 : -1}
            disabled={item.disabled}
            className={cx(styles.tab, selected && styles.selected)}
            onClick={() => onChange(item.value)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
