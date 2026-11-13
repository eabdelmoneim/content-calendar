import styles from "./series.module.css";

/** Data series tokens, in order (DESIGN.md › Data series). Never for text. */
export type SeriesColor = "chart-1" | "chart-2" | "chart-3" | "chart-4";

export const SERIES_ORDER: SeriesColor[] = [
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
];

/**
 * Each class sets `--series` to the token, so a component can paint fills,
 * strokes or legend bars with `var(--series)`.
 */
export const SERIES_CLASS: Record<SeriesColor | "hatch" | "muted", string> = {
  "chart-1": styles.c1,
  "chart-2": styles.c2,
  "chart-3": styles.c3,
  "chart-4": styles.c4,
  hatch: styles.hatch,
  muted: styles.muted,
};

/** Series colour for the nth entity; past the fourth, entities share rest. */
export function seriesAt(index: number): SeriesColor | "muted" {
  // DESIGN-QUESTION: only four data series are defined. Entities past the
  // fourth fall back to the muted swatch rather than inventing a fifth colour.
  return SERIES_ORDER[index] ?? "muted";
}
