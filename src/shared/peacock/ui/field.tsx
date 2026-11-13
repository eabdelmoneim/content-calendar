import type { ReactNode } from "react";
import { cx } from "./cx";
import styles from "./field.module.css";

export type FieldProps = {
  /** id of the control the label points at. */
  htmlFor: string;
  label?: ReactNode;
  /** Neutral helper text below the control. Hidden while `error` is set. */
  hint?: ReactNode;
  /** Error text below the control, e.g. "Enter a full email address." */
  error?: ReactNode;
  hintId?: string;
  errorId?: string;
  className?: string;
  children: ReactNode;
};

/** Label-above / message-below wrapper shared by Input, Select, Textarea, Combobox. */
export function Field({
  htmlFor,
  label,
  hint,
  error,
  hintId,
  errorId,
  className,
  children,
}: FieldProps): React.JSX.Element {
  return (
    <div className={cx(styles.field, className)}>
      {label ? (
        <label className={styles.label} htmlFor={htmlFor}>
          {label}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className={styles.error} id={errorId}>
          {error}
        </p>
      ) : hint ? (
        <p className={styles.hint} id={hintId}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Builds aria-describedby / ids for a field. */
export function fieldIds(
  id: string,
  hint: ReactNode,
  error: ReactNode,
): { hintId: string; errorId: string; describedBy: string | undefined } {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = error ? errorId : hint ? hintId : undefined;
  return { hintId, errorId, describedBy };
}
