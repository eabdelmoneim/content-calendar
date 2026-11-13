"use client";

import { useState, type ReactNode } from "react";
import styles from "./avatar.module.css";
import { cx } from "./cx";

export type AvatarTone =
  "neutral" | "blue" | "teal" | "green" | "amber" | "red" | "violet" | "pink";
/** 40: table rows with a subline. 48: drawer and profile headers. */
export type AvatarSize = 16 | 20 | 24 | 28 | 32 | 40 | 48;

const HASHED_TONES: AvatarTone[] = [
  "teal",
  "violet",
  "amber",
  "pink",
  "blue",
  "green",
  "red",
];

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

/** Stable tone per name so a person keeps their colour across screens. */
export function toneFor(name: string): AvatarTone {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return HASHED_TONES[Math.abs(hash) % HASHED_TONES.length];
}

export type AvatarProps = {
  name: string;
  size?: AvatarSize;
  tone?: AvatarTone;
  /** Optional image; initials are the fallback. */
  src?: string;
  /** 14px rounded-square platform badge at bottom-right (10px brand icon). */
  badge?: ReactNode;
  /** Decorative avatars next to a visible name should pass true. */
  decorative?: boolean;
  /** Remote CDN photos (LinkedIn feed) pass "no-referrer". */
  referrerPolicy?: React.HTMLAttributeReferrerPolicy;
  className?: string;
};

/** Initials on a label-tinted circle (COMPONENTS.md › Avatar). */
export function Avatar({
  name,
  size = 28,
  tone,
  src,
  badge,
  decorative = false,
  referrerPolicy,
  className,
}: AvatarProps): React.JSX.Element {
  const resolvedTone = tone ?? toneFor(name);
  // A remote photo can expire or be blocked; fall back to initials.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = Boolean(src) && failedSrc !== src;
  return (
    <span
      className={cx(
        styles.avatar,
        styles[`s${size}`],
        styles[resolvedTone],
        className,
      )}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : name}
      aria-hidden={decorative || undefined}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote avatar URLs, sized by CSS
        <img
          className={styles.image}
          src={src}
          alt=""
          referrerPolicy={referrerPolicy}
          onError={() => setFailedSrc(src ?? null)}
        />
      ) : (
        <span className={styles.initials} aria-hidden>
          {initialsOf(name)}
        </span>
      )}
      {badge ? (
        <span className={styles.badge} aria-hidden>
          {badge}
        </span>
      ) : null}
    </span>
  );
}

export type AvatarGroupProps = {
  people: Array<Pick<AvatarProps, "name" | "tone" | "src">>;
  size?: AvatarSize;
  /** Show at most this many, then a "+N" avatar. */
  max?: number;
  /** Accessible label for the group, e.g. "3 authors". */
  label?: string;
  className?: string;
};

/** Stacked avatars overlapping by 5px with a 2px --bg ring. */
export function AvatarGroup({
  people,
  size = 20,
  max = 4,
  label,
  className,
}: AvatarGroupProps): React.JSX.Element {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  const groupLabel = label ?? people.map((person) => person.name).join(", ");
  return (
    <span
      className={cx(styles.group, className)}
      role="img"
      aria-label={groupLabel}
    >
      {shown.map((person, index) => (
        <Avatar
          key={`${person.name}-${index}`}
          {...person}
          size={size}
          decorative
          className={styles.stacked}
        />
      ))}
      {extra > 0 ? (
        <span
          className={cx(
            styles.avatar,
            styles[`s${size}`],
            styles.neutral,
            styles.stacked,
          )}
          aria-hidden
        >
          <span className={styles.initials}>+{extra}</span>
        </span>
      ) : null}
    </span>
  );
}
