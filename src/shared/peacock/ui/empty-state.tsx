import type { ReactNode } from "react";
import { cx } from "./cx";
import styles from "./empty-state.module.css";

export type EmptyStateProps = {
  /** lucide icon element (rendered at 20px). */
  icon: ReactNode;
  title: ReactNode;
  /** Explain why the area is empty. */
  body: ReactNode;
  /** The one action. */
  action?: ReactNode;
  headingLevel?: 2 | 3 | 4;
  className?: string;
};

/** Centred empty state (COMPONENTS.md › EmptyState). */
export function EmptyState({
  icon,
  title,
  body,
  action,
  headingLevel = 3,
  className,
}: EmptyStateProps): React.JSX.Element {
  const Heading = `h${headingLevel}` as const;
  return (
    <div className={cx(styles.empty, className)}>
      <span className={styles.tile} aria-hidden>
        {icon}
      </span>
      <Heading className={styles.title}>{title}</Heading>
      <p className={styles.body}>{body}</p>
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}
