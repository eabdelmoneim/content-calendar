import { ChevronDown } from "lucide-react";
import type { ReactNode, SelectHTMLAttributes } from "react";
import { forwardRef, useId } from "react";
import control from "./control.module.css";
import { cx, ICON_STROKE } from "./cx";
import { Field, fieldIds } from "./field";
import styles from "./select.module.css";

export type SelectOption = { value: string; label: string; disabled?: boolean };

export type SelectProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "size" | "children"
> & {
  options: SelectOption[];
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  placeholder?: string;
  fieldClassName?: string;
};

/**
 * Native select styled as a Peacock control. Native keeps keyboard, mobile
 * pickers and screen-reader support for free.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select(
    {
      id,
      options,
      label,
      hint,
      error,
      placeholder,
      className,
      fieldClassName,
      ...rest
    },
    ref,
  ) {
    const autoId = useId();
    const selectId = id ?? autoId;
    const ids = fieldIds(selectId, hint, error);

    return (
      <Field
        htmlFor={selectId}
        label={label}
        hint={hint}
        error={error}
        hintId={ids.hintId}
        errorId={ids.errorId}
        className={fieldClassName}
      >
        <span className={styles.wrap}>
          <select
            ref={ref}
            id={selectId}
            className={cx(control.control, styles.select, className)}
            aria-invalid={error ? true : undefined}
            aria-describedby={ids.describedBy}
            {...rest}
          >
            {placeholder ? (
              <option value="" disabled>
                {placeholder}
              </option>
            ) : null}
            {options.map((option) => (
              <option
                key={option.value}
                value={option.value}
                disabled={option.disabled}
              >
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown
            className={styles.chevron}
            size={14}
            strokeWidth={ICON_STROKE}
            aria-hidden
          />
        </span>
      </Field>
    );
  },
);
