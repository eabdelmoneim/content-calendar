import Link from "next/link";
import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "../ui/cx";
import styles from "./card.module.css";

export type CardProps = HTMLAttributes<HTMLElement> & {
  /**
   * `padded` for chart/summary cards (18 20 16). `flush` for cards holding a
   * DataTable, which insets itself 12px from the card edge.
   */
  padding?: "padded" | "flush" | "none";
  as?: "section" | "div";
};

/** Flat white card on the canvas (COMPONENTS.md › Card). No drop shadow. */
export function Card({
  padding = "padded",
  as: Tag = "section",
  className,
  children,
  ...rest
}: CardProps): React.JSX.Element {
  return (
    <Tag
      className={cx(
        styles.card,
        padding === "padded" && styles.padded,
        padding === "flush" && styles.flush,
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export type CardHeaderProps = {
  /** lucide icon element, rendered at 15px inside the 28px tile. */
  icon?: ReactNode;
  title: ReactNode;
  /** Heading level for the title; cards under a page h1 default to h2. */
  headingLevel?: 2 | 3 | 4;
  /** Id for the heading, so the Card can use aria-labelledby. */
  id?: string;
  /** Optional right-aligned control: compact Segmented, Select, etc. */
  actions?: ReactNode;
  /** "See all" / "Manage" link, rendered after `actions`. */
  link?: { href: string; label: string };
  className?: string;
};

/** 28px icon tile, 14/20 title, optional action (COMPONENTS.md › CardHeader). */
export function CardHeader({
  icon,
  title,
  headingLevel = 2,
  id,
  actions,
  link,
  className,
}: CardHeaderProps): React.JSX.Element {
  const Heading = `h${headingLevel}` as const;
  return (
    <div className={cx(styles.header, className)}>
      {icon ? (
        <span className={styles.tile} aria-hidden>
          {icon}
        </span>
      ) : null}
      <Heading id={id} className={styles.title}>
        {title}
      </Heading>
      {actions || link ? (
        <div className={styles.actions}>
          {actions}
          {link ? (
            <Link href={link.href} className={styles.link}>
              {link.label}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** The 28px icon tile on its own (KPI cards, table leading cells). */
export function IconTile({
  icon,
  size = "md",
  className,
}: {
  icon: ReactNode;
  /** md = 28px (7px radius); lg = 30px (8px radius) for table leading cells. */
  size?: "md" | "lg";
  className?: string;
}): React.JSX.Element {
  return (
    <span
      className={cx(styles.tile, size === "lg" && styles.tileLg, className)}
      aria-hidden
    >
      {icon}
    </span>
  );
}
