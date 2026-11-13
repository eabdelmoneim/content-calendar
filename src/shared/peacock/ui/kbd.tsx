import { cx } from "./cx";
import styles from "./kbd.module.css";

export type KbdProps = {
  /** One or more keys, e.g. ["⌘", "K"] or ["G", "M"]. */
  keys: string[];
  /** Spoken form when the glyphs are ambiguous, e.g. "Command K". */
  label?: string;
  className?: string;
};

/**
 * Keyboard shortcut hint (as in the ⌘K palette prototype): 11/16 500
 * --fg-subtle on a 1px inset ring.
 */
export function Kbd({ keys, label, className }: KbdProps): React.JSX.Element {
  return (
    <span
      className={cx(styles.group, className)}
      aria-label={label}
      role={label ? "img" : undefined}
    >
      {keys.map((key, index) => (
        <kbd key={`${key}-${index}`} className={styles.key}>
          {key}
        </kbd>
      ))}
    </span>
  );
}
