import { Search } from "lucide-react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { forwardRef, useId } from "react";
import control from "./control.module.css";
import { cx, ICON_STROKE } from "./cx";
import { Field, fieldIds } from "./field";
import styles from "./input.module.css";

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  label?: ReactNode;
  hint?: ReactNode;
  /** Error text; also sets aria-invalid. */
  error?: ReactNode;
  /** Leading icon. `type="search"` gets the search icon by default. */
  icon?: ReactNode;
  fieldClassName?: string;
};

/** Text input with optional label, leading icon, hint and error. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    id,
    label,
    hint,
    error,
    icon,
    type = "text",
    className,
    fieldClassName,
    ...rest
  },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const ids = fieldIds(inputId, hint, error);
  const leading =
    icon ??
    (type === "search" ? <Search size={14} strokeWidth={ICON_STROKE} /> : null);

  return (
    <Field
      htmlFor={inputId}
      label={label}
      hint={hint}
      error={error}
      hintId={ids.hintId}
      errorId={ids.errorId}
      className={fieldClassName}
    >
      <span className={styles.wrap}>
        {leading ? (
          <span className={styles.leading} aria-hidden>
            {leading}
          </span>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          type={type}
          className={cx(
            control.control,
            leading ? styles.withIcon : undefined,
            className,
          )}
          aria-invalid={error ? true : undefined}
          aria-describedby={ids.describedBy}
          {...rest}
        />
      </span>
    </Field>
  );
});
