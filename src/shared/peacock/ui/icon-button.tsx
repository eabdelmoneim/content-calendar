import type { ButtonHTMLAttributes, ReactNode } from "react";
import { forwardRef } from "react";
import { cx } from "./cx";
import styles from "./icon-button.module.css";

export type IconButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-label" | "children"
> & {
  /** Required: icon-only buttons need an accessible name. */
  "aria-label": string;
  icon: ReactNode;
  size?: "sm" | "md";
  variant?: "ghost" | "secondary";
};

/** Square icon-only button (COMPONENTS.md › IconButton). Ghost by default. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      icon,
      size = "md",
      variant = "ghost",
      className,
      type = "button",
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cx(
          styles.iconButton,
          styles[size],
          styles[variant],
          className,
        )}
        {...rest}
      >
        <span className={styles.glyph} aria-hidden>
          {icon}
        </span>
      </button>
    );
  },
);
