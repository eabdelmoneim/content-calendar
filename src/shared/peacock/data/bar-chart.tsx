"use client";

import type { KeyboardEvent } from "react";
import { useId, useMemo, useRef, useState } from "react";
import { formatCount, formatShortDate } from "../format";
import { cx } from "../ui/cx";
import styles from "./bar-chart.module.css";

export type BarPoint = {
  /** Calendar day, "YYYY-MM-DD". */
  date: string;
  value: number;
  /** A gap is distinct from a measured zero. */
  missing?: boolean;
};

/**
 * How a week is summarised: counts sum, follower totals take the week's last
 * value, and rates take the mean (COMPONENTS.md › BarChart).
 */
export type WeeklyAggregate = "sum" | "last" | "mean";

export type BarChartProps = {
  series: BarPoint[];
  interval?: "day" | "week";
  /** Accessible name, e.g. "Impressions per day". */
  label: string;
  /** Formats a bar value for its label, summary and table. */
  format?: (value: number) => string;
  weeklyAggregate?: WeeklyAggregate;
  /**
   * `zero` (default) starts bars at 0. `growth` uses 0.985 × min(series) so
   * small changes in large totals (followers) stay visible.
   */
  baseline?: "zero" | "growth";
  /** Controlled focused bar. Defaults to the peak and follows hover/focus. */
  focusedIndex?: number;
  onFocusedIndexChange?: (index: number) => void;
  className?: string;
};

export type Bar = {
  missing?: boolean;
  /** First day the bar covers. */
  date: string;
  value: number;
  /** Visible axis label for the bar ("Sep 30" or "Week of Sep 30"). */
  label: string;
};

/** Groups consecutive 7-day runs from the first day; a short final week is kept. */
export function bucketWeekly(
  series: BarPoint[],
  aggregate: WeeklyAggregate = "sum",
): BarPoint[] {
  const out: BarPoint[] = [];
  for (let start = 0; start < series.length; start += 7) {
    const week = series.slice(start, start + 7);
    const values = week.map((point) => point.value);
    const total = values.reduce((sum, v) => sum + v, 0);
    const value =
      aggregate === "last"
        ? values[values.length - 1]
        : aggregate === "mean"
          ? total / values.length
          : total;
    out.push({
      date: week[0].date,
      value,
      ...((
        aggregate === "last"
          ? week[week.length - 1].missing
          : week.some((point) => point.missing)
      )
        ? { missing: true }
        : {}),
    });
  }
  return out;
}

/** Bar heights as percentages: max(3%, (v − min) / (max − min) × 86%). */
export function barHeights(
  values: number[],
  baseline: "zero" | "growth" = "zero",
): number[] {
  if (values.length === 0) return [];
  const max = Math.max(...values);
  const min = baseline === "growth" ? Math.min(...values) * 0.985 : 0;
  const range = max - min || 1;
  return values.map((v) => Math.max(3, ((v - min) / range) * 86));
}

/** Index of the largest value (first one on ties); -1 for an empty series. */
export function peakIndex(values: number[]): number {
  if (values.length === 0) return -1;
  return values.indexOf(Math.max(...values));
}

/** Columns either side of a shown label that stay blank so labels don't collide. */
const AXIS_LABEL_CLEARANCE = 3;

/**
 * Daily axis shows every 7th day, the last day and the focused day, dropping
 * any label too close to a more important one (focused, then last); weekly
 * shows every week.
 */
export function showsAxisLabel(
  index: number,
  count: number,
  focused: number,
  interval: "day" | "week",
): boolean {
  if (interval === "week") return true;
  if (index === focused) return true;
  if (Math.abs(index - focused) <= AXIS_LABEL_CLEARANCE) return false;
  if (index === count - 1) return true;
  return index % 7 === 0 && count - 1 - index > AXIS_LABEL_CLEARANCE;
}

export function BarChart({
  series,
  interval = "day",
  label,
  format = formatCount,
  weeklyAggregate = "sum",
  baseline = "zero",
  focusedIndex,
  onFocusedIndexChange,
  className,
}: BarChartProps): React.JSX.Element {
  const id = useId();
  const summaryId = `${id}-summary`;
  const barsRef = useRef<HTMLDivElement>(null);

  const bars: Bar[] = useMemo(() => {
    const points =
      interval === "week" ? bucketWeekly(series, weeklyAggregate) : series;
    return points.map((point) => ({
      ...point,
      label:
        interval === "week"
          ? `Week of ${formatShortDate(point.date)}`
          : formatShortDate(point.date),
    }));
  }, [series, interval, weeklyAggregate]);

  const values = bars.map((bar) => (bar.missing ? 0 : bar.value));
  const heights = barHeights(values, baseline);
  const peak = peakIndex(values);

  const [internal, setInternal] = useState<{
    key: string;
    index: number;
  } | null>(null);
  // Reset the hovered bar when the data shape changes (new metric/interval).
  const shapeKey = `${interval}:${bars.length}:${bars[0]?.date ?? ""}`;
  const uncontrolled =
    internal && internal.key === shapeKey && internal.index < bars.length
      ? internal.index
      : peak;
  const focused =
    focusedIndex !== undefined &&
    focusedIndex >= 0 &&
    focusedIndex < bars.length
      ? focusedIndex
      : uncontrolled;

  function setFocused(index: number): void {
    setInternal({ key: shapeKey, index });
    onFocusedIndexChange?.(index);
  }

  function moveTo(index: number): void {
    setFocused(index);
    barsRef.current
      ?.querySelector<HTMLElement>(`[data-index="${index}"]`)
      ?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (bars.length === 0) return;
    let next: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowUp")
      next = Math.min(focused + 1, bars.length - 1);
    else if (event.key === "ArrowLeft" || event.key === "ArrowDown")
      next = Math.max(focused - 1, 0);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = bars.length - 1;
    if (next === null) return;
    event.preventDefault();
    moveTo(next);
  }

  const summary = summarise(bars, label, format, interval);
  const unit = interval === "week" ? "Week" : "Date";

  return (
    <div
      className={cx(
        styles.root,
        interval === "week" && styles.weekly,
        className,
      )}
    >
      <p id={summaryId} className="sr-only">
        {summary}
      </p>
      <div
        ref={barsRef}
        role="group"
        aria-roledescription="bar chart"
        aria-label={label}
        aria-describedby={summaryId}
        className={styles.plot}
        onKeyDown={onKeyDown}
      >
        {bars.map((bar, index) => {
          const on = index === focused;
          const text = bar.missing ? "Unavailable" : format(bar.value);
          const edge = edgeClass(index, bars.length);
          return (
            <div
              key={bar.date}
              data-index={index}
              role="img"
              aria-label={`${bar.label}: ${text}`}
              aria-current={on ? "true" : undefined}
              tabIndex={on ? 0 : -1}
              className={cx(styles.column, on && styles.focused)}
              onPointerEnter={() => setFocused(index)}
              onFocus={() => {
                if (!on) setFocused(index);
              }}
            >
              {on ? (
                <span className={cx(styles.value, edge)} aria-hidden>
                  {text}
                </span>
              ) : null}
              <span
                className={cx(styles.bar, bar.missing && styles.missing)}
                style={{ height: `${bar.missing ? 3 : heights[index]}%` }}
                aria-hidden
              />
            </div>
          );
        })}
      </div>
      <div className={styles.axis} aria-hidden>
        {bars.map((bar, index) => (
          <span
            key={bar.date}
            className={cx(
              styles.tick,
              edgeClass(index, bars.length),
              index === focused && styles.tickOn,
            )}
          >
            {!showsAxisLabel(index, bars.length, focused, interval) ? (
              ""
            ) : interval === "week" ? (
              // The prefix drops on phones so four weekly labels fit.
              <>
                <span className={styles.weekPrefix}>Week of&nbsp;</span>
                {formatShortDate(bar.date)}
              </>
            ) : (
              bar.label
            )}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">{unit}</th>
            <th scope="col">Value</th>
          </tr>
        </thead>
        <tbody>
          {bars.map((bar) => (
            <tr key={bar.date}>
              <th scope="row">{bar.label}</th>
              <td>{bar.missing ? "Unavailable" : format(bar.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function summarise(
  bars: Bar[],
  label: string,
  format: (value: number) => string,
  interval: "day" | "week",
): string {
  if (bars.length === 0) return `${label}. No data.`;
  const observed = bars.filter((bar) => !bar.missing);
  if (!observed.length)
    return `${label}. No daily observations available. Use the arrow keys to inspect unavailable days.`;
  const values = observed.map((bar) => bar.value);
  const hi = peakIndex(values);
  const lo = values.indexOf(Math.min(...values));
  const span = `${bars.length} ${interval === "week" ? "weeks" : "days"}`;
  const range =
    bars.length > 1
      ? ` from ${bars[0].label} to ${bars[bars.length - 1].label}`
      : ` on ${bars[0].label}`;
  return `${label}. ${span}${range}. Highest ${format(values[hi])} on ${observed[hi].label}. Lowest ${format(values[lo])} on ${observed[lo].label}. Use the arrow keys to move between bars.`;
}

/** Labels on the outermost columns hug the plot edge instead of centring, so a
 *  value wider than its column never spills past the chart and scrolls the page. */
function edgeClass(index: number, count: number) {
  if (count > 1 && index === 0) return styles.edgeStart;
  if (count > 1 && index === count - 1) return styles.edgeEnd;
  return undefined;
}
