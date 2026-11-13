"use client";

import { Info } from "lucide-react";
import type { ReactNode } from "react";
import { useId } from "react";
import { Skeleton } from "../ui/skeleton";
import { Tooltip } from "../ui/tooltip";
import { cx } from "../ui/cx";
import { IconTile } from "./card";
import { DeltaPill, type DeltaPillProps } from "./delta-pill";
import styles from "./kpi-card.module.css";

export type KpiCardProps = {
  /** lucide icon element (15px) for the 28px tile. */
  icon: ReactNode;
  label: string;
  /** Metric definition, shown in the info tooltip and announced as a description. */
  definition?: string;
  /** Pre-formatted value, e.g. "48,210" or "3.8%". */
  value: ReactNode;
  delta?: DeltaPillProps;
  /** Text after the pill, e.g. "vs previous 28 days". */
  comparison?: string;
  /** Only meaningful with `onSelect`; rendered as aria-pressed. */
  selected?: boolean;
  /** Makes the card a `<button aria-pressed>` metric picker. */
  onSelect?: () => void;
  loading?: boolean;
  className?: string;
};

/**
 * KPI card (COMPONENTS.md › KpiCard). With `onSelect` it is a toggle button
 * that picks the charted metric; otherwise a static figure.
 */
export function KpiCard({
  icon,
  label,
  definition,
  value,
  delta,
  comparison,
  selected = false,
  onSelect,
  loading = false,
  className,
}: KpiCardProps): React.JSX.Element {
  const definitionId = useId();

  if (loading) {
    return (
      <div
        className={cx(styles.card, styles.loading, className)}
        aria-busy="true"
        aria-label={`${label}, loading`}
        role="group"
      >
        <Skeleton width="50%" height={14} />
        <Skeleton width="70%" height={28} radius="sm" />
      </div>
    );
  }

  const body = (
    <>
      <span className={styles.head}>
        <IconTile icon={icon} />
        <span className={styles.label}>{label}</span>
        {definition ? (
          // The info glyph is a hover affordance only: it sits inside the card
          // button, so it can't be focusable. Keyboard and screen-reader users
          // get the same text through aria-describedby on the card.
          <Tooltip
            content={definition}
            align="end"
            className={styles.infoAnchor}
          >
            <span className={styles.info} aria-hidden>
              <Info size={15} strokeWidth={1.75} />
            </span>
          </Tooltip>
        ) : null}
      </span>
      <span className={styles.valueRow}>
        <span className={styles.value}>{value}</span>
        {delta ? <DeltaPill {...delta} /> : null}
        {comparison ? (
          <span className={styles.comparison}>{comparison}</span>
        ) : null}
      </span>
      {definition ? (
        <span id={definitionId} hidden>
          {definition}
        </span>
      ) : null}
    </>
  );

  if (onSelect) {
    return (
      <button
        type="button"
        aria-pressed={selected}
        aria-describedby={definition ? definitionId : undefined}
        className={cx(
          styles.card,
          styles.interactive,
          selected && styles.selected,
          className,
        )}
        onClick={onSelect}
      >
        {body}
      </button>
    );
  }

  return (
    <div
      role="group"
      aria-label={label}
      aria-describedby={definition ? definitionId : undefined}
      className={cx(styles.card, className)}
    >
      {body}
    </div>
  );
}
