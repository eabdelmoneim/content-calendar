import { cx } from "@/shared/peacock/ui";
import styles from "./analytics.module.css";

type BrandProps = { size?: number; className?: string; title?: string };

/** LinkedIn "in" mark in the official blue (lucide has no brand icons). */
export function LinkedInMark({
  size = 14,
  className,
  title,
}: BrandProps): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={cx(styles.linkedInMark, className)}
    >
      <path
        fill="currentColor"
        d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z"
      />
    </svg>
  );
}

/** X mark; uses currentColor (DESIGN.md › Iconography). */
export function XMark({
  size = 14,
  className,
  title,
}: BrandProps): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={className}
    >
      <path
        fill="currentColor"
        d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
      />
    </svg>
  );
}

export function PlatformMark({
  platform,
  size,
  title,
}: BrandProps & { platform: "linkedin" | "x" }): React.JSX.Element {
  return platform === "x" ? (
    <XMark size={size} title={title} />
  ) : (
    <LinkedInMark size={size} title={title} />
  );
}
