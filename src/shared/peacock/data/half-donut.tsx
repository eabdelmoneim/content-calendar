import { useId } from "react";
import { formatCount } from "../format";
import { cx } from "../ui/cx";
import styles from "./half-donut.module.css";
import { SERIES_CLASS, type SeriesColor } from "./series";

export type HalfDonutSegment = {
  label: string;
  value: number;
  /** A chart series token, or `hatch` for the remainder segment. */
  color: SeriesColor | "hatch";
};

export type HalfDonutProps = {
  segments: HalfDonutSegment[];
  /** Pre-formatted total shown under the arc, e.g. "1,362". */
  total: string;
  /** Caption under the total, e.g. "interactions". */
  caption: string;
  /** Accessible name prefix, e.g. "Engagement breakdown". */
  label: string;
  format?: (value: number) => string;
  className?: string;
};

const CX = 120;
const CY = 120;
const RADIUS = 82;
const GAP_DEG = 1.6;

function point(angle: number): string {
  const rad = (angle * Math.PI) / 180;
  return `${(CX + RADIUS * Math.cos(rad)).toFixed(2)} ${(CY - RADIUS * Math.sin(rad)).toFixed(2)}`;
}

/** SVG arc from a1° to a2° (clockwise, 180° is the left end). */
export function arcPath(a1: number, a2: number): string {
  return `M${point(a1)} A${RADIUS} ${RADIUS} 0 0 1 ${point(a2)}`;
}

/**
 * Arc paths for each non-zero segment: 180° → 0°, proportional sweep, with a
 * 1.6° gap between neighbours (DESIGN.md › Half donut).
 */
export function donutArcs(
  segments: HalfDonutSegment[],
): Array<{ segment: HalfDonutSegment; d: string }> {
  const visible = segments.filter((s) => s.value > 0);
  const total = visible.reduce((sum, s) => sum + s.value, 0);
  if (total <= 0) return [];
  let angle = 180;
  return visible.map((segment, i) => {
    const sweep = (segment.value / total) * 180;
    const a1 = angle - (i > 0 ? GAP_DEG / 2 : 0);
    const a2 = angle - sweep + (i < visible.length - 1 ? GAP_DEG / 2 : 0);
    angle -= sweep;
    return { segment, d: arcPath(a1, a2) };
  });
}

/** 180° distribution arc with its legend above (COMPONENTS.md › HalfDonut). */
export function HalfDonut({
  segments,
  total,
  caption,
  label,
  format = formatCount,
  className,
}: HalfDonutProps): React.JSX.Element {
  // useId output can contain characters that break url(#…) references.
  const patternId = `pk-hatch-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const arcs = donutArcs(segments);
  const aria = `${label}: ${segments
    .map((s) => `${s.label} ${format(s.value)}`)
    .join(", ")}. Total ${total} ${caption}.`;

  return (
    <div className={cx(styles.root, className)}>
      <ul
        className={styles.legend}
        style={{
          gridTemplateColumns: `repeat(${Math.max(segments.length, 1)}, minmax(0, 1fr))`,
        }}
        aria-label={`${label} legend`}
      >
        {segments.map((s) => (
          <li
            key={s.label}
            className={cx(styles.legendItem, SERIES_CLASS[s.color])}
          >
            <span className={styles.legendLabel}>{s.label}</span>
            <span className={styles.legendValue}>{format(s.value)}</span>
          </li>
        ))}
      </ul>
      <div className={styles.plot}>
        <svg viewBox="0 0 240 128" role="img" aria-label={aria}>
          <defs>
            <pattern
              id={patternId}
              width="4"
              height="4"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect width="4" height="4" className={styles.hatchBg} />
              <line x1="0" y1="0" x2="0" y2="4" className={styles.hatchLine} />
            </pattern>
          </defs>
          <path d={arcPath(180, 0)} className={styles.track} />
          {arcs.map(({ segment, d }) => (
            <path
              key={segment.label}
              d={d}
              className={cx(
                styles.arc,
                segment.color !== "hatch" && SERIES_CLASS[segment.color],
              )}
              style={
                segment.color === "hatch"
                  ? { stroke: `url(#${patternId})` }
                  : undefined
              }
            />
          ))}
          <text x="120" y="112" textAnchor="middle" className={styles.total}>
            {total}
          </text>
          <text x="120" y="126" textAnchor="middle" className={styles.caption}>
            {caption}
          </text>
        </svg>
      </div>
    </div>
  );
}
