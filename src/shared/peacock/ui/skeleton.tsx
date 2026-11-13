import type { CSSProperties } from "react";
import { cx } from "./cx";
import styles from "./skeleton.module.css";

export type SkeletonProps = {
  width?: CSSProperties["width"];
  height?: CSSProperties["height"];
  /** Match the loaded element: text 4px, controls md, cards lg, avatars full. */
  radius?: "text" | "sm" | "md" | "lg" | "full";
  className?: string;
};

/** Pulsing placeholder block. Decorative; mark the loading region with aria-busy. */
export function Skeleton({
  width = "100%",
  height = 12,
  radius = "text",
  className,
}: SkeletonProps): React.JSX.Element {
  return (
    <span
      aria-hidden
      className={cx(styles.skeleton, styles[radius], className)}
      style={{ width, height }}
    />
  );
}
