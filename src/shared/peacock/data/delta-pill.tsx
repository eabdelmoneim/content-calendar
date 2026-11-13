import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import {
  deltaDirection,
  formatDelta,
  type DeltaDirection,
  type DeltaFormat,
} from "../format";
import { cx } from "../ui/cx";
import styles from "./delta-pill.module.css";

export type DeltaTone = "positive" | "negative" | "neutral";

export type DeltaPillProps = {
  /**
   * Signed change in the units of `format`: percent change (12.4), percentage
   * points (−0.6) or an absolute count (+214).
   */
  value: number;
  format?: DeltaFormat;
  digits?: number;
  /** Defaults to the sign of `value` (|value| ≤ `flatEpsilon` is flat). */
  direction?: DeltaDirection;
  flatEpsilon?: number;
  /**
   * "Good" isn't always "up". Defaults to positive for up, negative for down
   * and neutral for flat; pass `tone` when a decrease is good.
   */
  tone?: DeltaTone;
  /** Overrides the visible text (still announced with its direction). */
  label?: string;
  className?: string;
};

const ICONS = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  flat: ArrowRight,
} as const;

const SPOKEN: Record<DeltaDirection, string> = {
  up: "Up",
  down: "Down",
  flat: "No change,",
};

const DEFAULT_TONE: Record<DeltaDirection, DeltaTone> = {
  up: "positive",
  down: "negative",
  flat: "neutral",
};

/**
 * Tinted change pill (DESIGN.md › Data display): 20px, 11.5px 500 tabular,
 * then an 11px arrow at stroke 2.25. Direction is announced in words so the
 * colour is never the only signal.
 */
export function DeltaPill({
  value,
  format = "percent",
  digits = 1,
  direction,
  flatEpsilon = 0,
  tone,
  label,
  className,
}: DeltaPillProps): React.JSX.Element {
  const dir = direction ?? deltaDirection(value, flatEpsilon);
  const resolvedTone = tone ?? DEFAULT_TONE[dir];
  const text = label ?? formatDelta(value, format, digits);
  const Icon = ICONS[dir];

  return (
    <span
      className={cx(styles.pill, styles[resolvedTone], className)}
      data-direction={dir}
      data-tone={resolvedTone}
    >
      <span className="sr-only">{SPOKEN[dir]} </span>
      {text}
      <Icon className={styles.icon} size={11} strokeWidth={2.25} aria-hidden />
    </span>
  );
}
