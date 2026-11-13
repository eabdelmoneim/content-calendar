import type { ReactNode } from "react";

import { Avatar, cx, Skeleton } from "@/shared/peacock/ui";

import styles from "./settings.module.css";

/** Header row for an in-card Settings table (ARIA table on a CSS grid). */
export function TableHead({
  gridClass,
  columns,
}: {
  gridClass: string;
  columns: Array<{ key: string; label: ReactNode }>;
}): React.JSX.Element {
  return (
    <div role="rowgroup">
      <div role="row" className={cx(styles.grid, gridClass, styles.head)}>
        {columns.map((column) => (
          <span key={column.key} role="columnheader" className={styles.headCell}>
            {column.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Avatar + name + subline. */
export function MemberEntity({
  name,
  subline,
  pictureUrl,
  mobileMeta,
}: {
  name: string;
  subline?: ReactNode;
  pictureUrl?: string;
  /** Extra line shown only in the stacked mobile layout. */
  mobileMeta?: ReactNode;
}): React.JSX.Element {
  return (
    <span className={styles.entity}>
      <Avatar name={name} src={pictureUrl} size={32} decorative />
      <span className={styles.entityText}>
        <span className={styles.entityTitle}>
          <span className={styles.entityName}>{name}</span>
        </span>
        {subline ? <span className={styles.entitySub}>{subline}</span> : null}
        {mobileMeta ? <span className={cx(styles.entitySub, styles.mobileMeta)}>{mobileMeta}</span> : null}
      </span>
    </span>
  );
}

export function SkeletonRows({ count = 4 }: { count?: number }): React.JSX.Element {
  return (
    <div role="status" aria-label="Loading">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={styles.skeletonRow}>
          <Skeleton width={32} height={32} radius="full" />
          <Skeleton width="28%" height={12} />
        </div>
      ))}
    </div>
  );
}
