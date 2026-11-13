import type { ReactNode } from "react";
import { formatCount } from "../format";
import { cx } from "../ui/cx";
import { SERIES_CLASS, seriesAt, type SeriesColor } from "./series";
import styles from "./stacked-bar.module.css";

export type StackedBarSegment = {
  label: string;
  value: number;
  /** Defaults to the series colour for the segment's position. */
  color?: SeriesColor | "muted";
};

export type StackedBarProps = {
  segments: StackedBarSegment[];
  /** Accessible name, e.g. "Followers by account". */
  label: string;
  format?: (value: number) => string;
  className?: string;
};

/**
 * 10px horizontal share bar, one segment per entity in series order,
 * `flex: value`, 3px radius, 3px gaps (COMPONENTS.md › StackedBar).
 * Zero-value segments are left out of the bar but stay in the legend.
 */
export function StackedBar({
  segments,
  label,
  format = formatCount,
  className,
}: StackedBarProps): React.JSX.Element {
  const total = segments.reduce((sum, s) => sum + Math.max(s.value, 0), 0);
  const aria = `${label}: ${segments
    .filter((s) => s.value > 0)
    .map(
      (s) =>
        `${s.label} ${format(s.value)} (${Math.round((s.value / total) * 100)}%)`,
    )
    .join(", ")}`;

  return (
    <div
      role="img"
      aria-label={total > 0 ? aria : `${label}: no data`}
      className={cx(styles.bar, className)}
    >
      {segments.map((s, i) =>
        s.value > 0 ? (
          <span
            key={s.label}
            className={cx(styles.segment, SERIES_CLASS[s.color ?? seriesAt(i)])}
            style={{ flexGrow: s.value }}
          />
        ) : null,
      )}
    </div>
  );
}

export type StackedBarLegendRow = {
  key: string;
  /** Swatch colour; match the StackedBar segment. */
  color: SeriesColor | "muted";
  /** Optional element between the swatch and the name (platform icon). */
  leading?: ReactNode;
  name: ReactNode;
  /** Secondary value, e.g. the follower count. */
  value?: ReactNode;
  /** Right-most slot: growth text or a StatusChip. */
  trailing?: ReactNode;
};

/** Legend rows: 8px swatch, name, value, trailing slot; 48px rows. */
export function StackedBarLegend({
  rows,
  className,
}: {
  rows: StackedBarLegendRow[];
  className?: string;
}): React.JSX.Element {
  return (
    <ul className={cx(styles.legend, className)}>
      {rows.map((row) => (
        <li key={row.key} className={styles.row}>
          <span
            className={cx(styles.swatch, SERIES_CLASS[row.color])}
            aria-hidden
          />
          {row.leading ? (
            <span className={styles.leading}>{row.leading}</span>
          ) : null}
          <span className={styles.name}>{row.name}</span>
          {row.value !== undefined ? (
            <span className={styles.value}>{row.value}</span>
          ) : null}
          {row.trailing !== undefined ? (
            <span className={styles.trailing}>{row.trailing}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** Growth text in a legend row: "+96" in 500 12px delta-up colour. */
export function GrowthText({
  children,
  tone = "positive",
}: {
  children: ReactNode;
  tone?: "positive" | "negative" | "neutral";
}): React.JSX.Element {
  return <span className={cx(styles.growth, styles[tone])}>{children}</span>;
}
