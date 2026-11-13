/**
 * Number formatting for Peacock data display (DESIGN.md › Data display).
 * All output is en-US so tabular columns line up and tests are stable.
 * Missing or non-finite values render as an em dash, which is only ever used
 * in single cells inside real data (never a whole grid of dashes).
 */

export const MISSING = "—";
/** U+2212, so negative numbers match the width of "+" in tabular figures. */
export const MINUS = "−";

export type DeltaFormat = "percent" | "pts" | "absolute";
export type DeltaDirection = "up" | "down" | "flat";

const grouped = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function isNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function fixed(value: number, digits: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/** 48210 → "48,210". Rounds to whole numbers. */
export function formatCount(value: number | null | undefined): string {
  if (!isNumber(value)) return MISSING;
  return grouped.format(Math.round(value)).replace("-", MINUS);
}

/** 48210 → "48.2K", 1_250_000 → "1.3M", 980 → "980". */
export function formatCompact(value: number | null | undefined): string {
  if (!isNumber(value)) return MISSING;
  if (Math.abs(value) < 1000) return formatCount(value);
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  })
    .format(value)
    .replace("-", MINUS);
}

/**
 * A value already in percent units: 12.4 → "12.4%".
 * Use `formatRatio` for 0–1 fractions.
 */
export function formatPercent(
  value: number | null | undefined,
  digits = 1,
): string {
  if (!isNumber(value)) return MISSING;
  return `${fixed(value, digits).replace("-", MINUS)}%`;
}

/** A 0–1 fraction as a percent: 0.038 → "3.8%". */
export function formatRatio(
  value: number | null | undefined,
  digits = 1,
): string {
  if (!isNumber(value)) return MISSING;
  return formatPercent(value * 100, digits);
}

/** Percentage-point change magnitude: 0.6 → "0.6 pts" (sign not shown). */
export function formatPts(
  value: number | null | undefined,
  digits = 1,
): string {
  if (!isNumber(value)) return MISSING;
  return `${fixed(Math.abs(value), digits)} pts`;
}

/** Signed whole-number change: 214 → "+214", −3 → "−3", 0 → "0". */
export function formatSignedCount(value: number | null | undefined): string {
  if (!isNumber(value)) return MISSING;
  const rounded = Math.round(value);
  if (rounded === 0) return "0";
  const body = grouped.format(Math.abs(rounded));
  return rounded > 0 ? `+${body}` : `${MINUS}${body}`;
}

/** Direction of a change, treating |value| below `epsilon` as flat. */
export function deltaDirection(value: number, epsilon = 0): DeltaDirection {
  if (!Number.isFinite(value) || Math.abs(value) <= epsilon) return "flat";
  return value > 0 ? "up" : "down";
}

/**
 * Delta pill text. Percent and pts show the magnitude only (the arrow carries
 * the direction); absolute changes carry an explicit sign.
 *   percent  12.4 → "12.4%"   pts −0.6 → "0.6 pts"   absolute 214 → "+214"
 */
export function formatDelta(
  value: number | null | undefined,
  format: DeltaFormat,
  digits = 1,
): string {
  if (!isNumber(value)) return MISSING;
  switch (format) {
    case "percent":
      return formatPercent(Math.abs(value), digits);
    case "pts":
      return formatPts(value, digits);
    case "absolute":
      return formatSignedCount(value);
  }
}

/**
 * Percent change between two periods, or null when there is no baseline.
 * (current 110, previous 100) → 10.
 */
export function percentChange(
  current: number | null | undefined,
  previous: number | null | undefined,
): number | null {
  if (!isNumber(current) || !isNumber(previous) || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/** "2026-09-30" → "Sep 30". Date-only strings are read as calendar dates. */
export function formatShortDate(date: string): string {
  const parsed = parseDay(date);
  if (!parsed) return date;
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Parses "YYYY-MM-DD" (or a full ISO timestamp) to a UTC-midnight Date. */
export function parseDay(date: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (!match) return null;
  const parsed = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
