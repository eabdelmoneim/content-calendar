import { cx } from "../ui/cx";
import styles from "./peacock-mark.module.css";

/** Temporary purple orb, shared across light and dark surfaces. */
export const PEACOCK_MARK_ON_LIGHT_SRC = "/brand/purple-orb.png";
/** Kept as a separate export for callers that pin the surface variant. */
export const PEACOCK_MARK_ON_DARK_SRC = PEACOCK_MARK_ON_LIGHT_SRC;

export type PeacockMarkVariant = "auto" | "light" | "dark";

export type PeacockMarkProps = {
  /**
   * The surface the mark sits on. `light` and `dark` pin one file; `auto`
   * follows `<html data-theme>` (the mark sits on `--bg` or `--bg-subtle`).
   */
  variant?: PeacockMarkVariant;
  /** Rendered width and height in px. */
  size?: number;
  /** Accessible name. Omit for a decorative mark (hidden from assistive tech). */
  alt?: string;
  className?: string;
};

/**
 * The temporary Peacock logo mark. With
 * `variant="auto"` both files render and CSS shows the one that matches the
 * theme, so there is no flash before hydration.
 */
export function PeacockMark({
  variant = "auto",
  size = 24,
  alt,
  className,
}: PeacockMarkProps): React.JSX.Element {
  const decorative = !alt;
  const image = (src: string, themeClass?: string) => (
    // eslint-disable-next-line @next/next/no-img-element -- static brand asset
    <img
      key={themeClass ?? src}
      className={cx(styles.mark, themeClass, !themeClass && className)}
      src={src}
      width={size}
      height={size}
      alt={alt ?? ""}
      aria-hidden={decorative || undefined}
      decoding="async"
      draggable={false}
    />
  );

  if (variant === "light") return image(PEACOCK_MARK_ON_LIGHT_SRC);
  if (variant === "dark") return image(PEACOCK_MARK_ON_DARK_SRC);
  return (
    <span
      className={cx(styles.auto, className)}
      style={{ width: size, height: size }}
      aria-hidden={decorative || undefined}
    >
      {image(PEACOCK_MARK_ON_LIGHT_SRC, styles.onLight)}
      {image(PEACOCK_MARK_ON_DARK_SRC, styles.onDark)}
    </span>
  );
}
