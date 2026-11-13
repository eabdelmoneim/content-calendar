import type { ReactNode, TextareaHTMLAttributes } from "react";
import { forwardRef, useId } from "react";
import control from "./control.module.css";
import { cx } from "./cx";
import { Field, fieldIds } from "./field";
import styles from "./textarea.module.css";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  fieldClassName?: string;
};

/** Multi-line text control sharing the Input box. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea(
    { id, label, hint, error, rows = 4, className, fieldClassName, ...rest },
    ref,
  ) {
    const autoId = useId();
    const textareaId = id ?? autoId;
    const ids = fieldIds(textareaId, hint, error);

    return (
      <Field
        htmlFor={textareaId}
        label={label}
        hint={hint}
        error={error}
        hintId={ids.hintId}
        errorId={ids.errorId}
        className={fieldClassName}
      >
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          className={cx(control.control, styles.textarea, className)}
          aria-invalid={error ? true : undefined}
          aria-describedby={ids.describedBy}
          {...rest}
        />
      </Field>
    );
  },
);
