"use client";

import { Check, Minus } from "lucide-react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import styles from "./checkbox.module.css";
import { cx } from "./cx";

export type CheckboxProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "size" | "onChange"
> & {
  checked: boolean;
  /** Shows a dash and reports aria-checked="mixed" (select-all headers). */
  indeterminate?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  /** Visible label. Omit and pass aria-label for table cells. */
  label?: ReactNode;
};

/**
 * 16px checkbox (COMPONENTS.md › Checkbox). A native input keeps the
 * checkbox role, aria-checked (incl. mixed) and form behaviour.
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox(
    {
      checked,
      indeterminate = false,
      onCheckedChange,
      label,
      className,
      disabled,
      ...rest
    },
    ref,
  ) {
    const inputRef = useRef<HTMLInputElement>(null);
    useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

    useEffect(() => {
      if (inputRef.current) inputRef.current.indeterminate = indeterminate;
    }, [indeterminate]);

    const on = checked || indeterminate;
    const Glyph = indeterminate ? Minus : Check;

    return (
      <label
        className={cx(styles.root, disabled && styles.disabled, className)}
      >
        <span className={styles.boxWrap}>
          <input
            ref={inputRef}
            type="checkbox"
            className={styles.input}
            checked={checked}
            disabled={disabled}
            onChange={(event) => {
              if (!disabled) onCheckedChange?.(event.target.checked);
            }}
            {...rest}
          />
          {on ? (
            <Glyph
              className={styles.glyph}
              size={10}
              strokeWidth={3}
              aria-hidden
            />
          ) : null}
        </span>
        {label ? <span className={styles.label}>{label}</span> : null}
      </label>
    );
  },
);
