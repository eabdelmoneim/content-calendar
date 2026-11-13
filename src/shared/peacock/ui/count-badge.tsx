import { formatCount } from "../format";
import styles from "./count-badge.module.css";
import { cx } from "./cx";

export type CountBadgeProps = {
  /** Numbers are grouped ("1,240"); strings render as given ("3 of 5"). */
  count: number | string;
  /**
   * `primary`: solid indigo, for active filter counts on a filter button.
   * `neutral`: muted, for tab and rail counts.
   */
  tone?: "primary" | "neutral";
  /**
   * Spoken text, e.g. "2 filters applied". Without it the badge is read as
   * part of its parent's name ("Warmness 2").
   */
  label?: string;
  className?: string;
};

/** Small tabular count pill for filter buttons and tab counts. */
export function CountBadge({
  count,
  tone = "neutral",
  label,
  className,
}: CountBadgeProps): React.JSX.Element {
  const text = typeof count === "number" ? formatCount(count) : count;
  return (
    <span className={cx(styles.badge, styles[tone], className)}>
      {label ? (
        <>
          <span aria-hidden>{text}</span>
          <span className={styles.srOnly}>{label}</span>
        </>
      ) : (
        text
      )}
    </span>
  );
}
