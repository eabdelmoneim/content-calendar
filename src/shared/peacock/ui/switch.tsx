"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { forwardRef, useId } from "react";
import { cx } from "./cx";
import styles from "./switch.module.css";

export type SwitchProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onChange" | "role" | "children" | "value"
> & {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  /** Visible label to the left of the track. Omit and pass aria-label instead. */
  label?: ReactNode;
  /** Secondary line under the label; wired to aria-describedby. */
  description?: ReactNode;
};

/**
 * On/off switch (role="switch"), 36×20 track. Takes effect immediately; use a
 * Checkbox inside forms that save on submit.
 */
export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  function Switch(
    {
      checked,
      onCheckedChange,
      label,
      description,
      disabled,
      className,
      onClick,
      type = "button",
      ...rest
    },
    ref,
  ) {
    const id = useId();
    const labelId = `${id}-label`;
    const descId = `${id}-desc`;
    const buttonId = rest.id ?? `${id}-switch`;
    const control = (
      <button
        ref={ref}
        type={type}
        id={buttonId}
        role="switch"
        aria-checked={checked}
        aria-labelledby={label ? labelId : undefined}
        aria-describedby={description ? descId : undefined}
        disabled={disabled}
        className={cx(
          styles.track,
          checked && styles.on,
          !label && styles.standalone,
          !label && className,
        )}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) onCheckedChange?.(!checked);
        }}
        {...rest}
      >
        <span className={styles.thumb} aria-hidden />
      </button>
    );
    if (!label) return control;
    return (
      <span className={cx(styles.root, disabled && styles.disabled, className)}>
        <span className={styles.text}>
          {/* A <label> activates the button it points at, so clicking the text toggles. */}
          <label id={labelId} htmlFor={buttonId} className={styles.label}>
            {label}
          </label>
          {description ? (
            <span id={descId} className={styles.description}>
              {description}
            </span>
          ) : null}
        </span>
        {control}
      </span>
    );
  },
);
