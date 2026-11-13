import { LoaderCircle } from "lucide-react";
import { cx } from "./cx";
import styles from "./spinner.module.css";

export type SpinnerProps = {
  /** Icon size in px; matches the text it sits beside. */
  size?: 12 | 13 | 14 | 16 | 20;
  /**
   * Spoken status, e.g. "Scoring". Without it the spinner is decorative and
   * the adjacent text ("Rescoring 12 of 40…") carries the meaning.
   */
  label?: string;
  className?: string;
};

/**
 * Inline progress glyph for status lines ("Scanning post 3 of 10"). Inherits
 * colour. Button and StatusChip already have their own spinners. Under
 * reduced motion it holds still.
 */
export function Spinner({
  size = 14,
  label,
  className,
}: SpinnerProps): React.JSX.Element {
  const icon = (
    <LoaderCircle
      className={cx(styles.spinner, !label && className)}
      size={size}
      strokeWidth={2}
      aria-hidden
    />
  );
  if (!label) return icon;
  return (
    <span
      role="status"
      aria-label={label}
      className={cx(styles.wrap, className)}
    >
      {icon}
    </span>
  );
}
