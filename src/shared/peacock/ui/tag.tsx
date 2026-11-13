import type { ReactNode } from "react";
import { cx } from "./cx";
import styles from "./tag.module.css";

/** `indigo` is an alias of `primary`. */
export type TagTone =
  | "neutral"
  | "blue"
  | "primary"
  | "indigo"
  | "green"
  | "amber"
  | "red"
  | "violet";

export type TagProps = {
  children: ReactNode;
  tone?: TagTone;
  /** Leading lucide icon; sized by `size` (12px sm, 14px md). */
  icon?: ReactNode;
  /** sm: 20px tall (default). md: 24px. */
  size?: "sm" | "md";
  /** Native tooltip, e.g. the full value of a truncated tag. */
  title?: string;
  className?: string;
};

/**
 * Generic label (bucket name, source, ICP criterion mode). A sibling of
 * StatusChip that shares its `--chip-*` tones but carries free text; use
 * StatusChip for product statuses.
 */
export function Tag({
  children,
  tone = "neutral",
  icon,
  size = "sm",
  title,
  className,
}: TagProps): React.JSX.Element {
  const resolved = tone === "indigo" ? "primary" : tone;
  return (
    <span
      className={cx(styles.tag, styles[size], styles[resolved], className)}
      data-tone={resolved}
      title={title}
    >
      {icon ? (
        <span className={styles.icon} aria-hidden>
          {icon}
        </span>
      ) : null}
      <span className={styles.text}>{children}</span>
    </span>
  );
}
