"use client";

import type { ReactElement, ReactNode } from "react";
import { cloneElement, useEffect, useId, useRef, useState } from "react";
import { cx } from "./cx";
import styles from "./tooltip.module.css";

export const TOOLTIP_DELAY_MS = 400;

export type TooltipProps = {
  content: ReactNode;
  /** A single focusable element; it receives aria-describedby. */
  children: ReactElement<{ "aria-describedby"?: string }>;
  side?: "top" | "bottom";
  /** "end" lines the tooltip up with the trigger's right edge, for triggers
   *  at the right of a container where a centred tooltip would spill out. */
  align?: "center" | "end";
  delay?: number;
  /**
   * Renders the same wrapper with no tooltip, so a trigger that gains or
   * loses its tooltip keeps its DOM node (and focus).
   */
  disabled?: boolean;
  className?: string;
};

/**
 * Inverse tooltip (COMPONENTS.md › Tooltip). Opens after 400ms on hover and
 * on keyboard focus, closes on leave, blur or Escape. Supplementary text
 * only: never put the only copy of something meaningful in a tooltip.
 */
export function Tooltip({
  content,
  children,
  side = "top",
  align = "center",
  delay = TOOLTIP_DELAY_MS,
  disabled = false,
  className,
}: TooltipProps): React.JSX.Element {
  const id = useId();
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clear(): void {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }

  function show(immediate: boolean): void {
    clear();
    if (disabled) return;
    if (immediate) setOpen(true);
    else timer.current = setTimeout(() => setOpen(true), delay);
  }

  function hide(): void {
    clear();
    setOpen(false);
  }

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent): void {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const existing = children.props["aria-describedby"];
  const trigger = disabled
    ? children
    : cloneElement(children, {
        "aria-describedby": existing ? `${existing} ${id}` : id,
      });

  return (
    <span
      className={cx(styles.anchor, className)}
      onPointerEnter={() => show(false)}
      onPointerLeave={hide}
      onFocus={(event) => {
        // Keyboard focus shows immediately; pointer focus waits for hover.
        show(isFocusVisible(event.target as HTMLElement));
      }}
      onBlur={hide}
    >
      {trigger}
      {disabled ? null : (
        <span
          id={id}
          role="tooltip"
          className={cx(
            styles.tooltip,
            styles[side],
            align === "end" && styles.end,
            open && styles.open,
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}

function isFocusVisible(el: HTMLElement): boolean {
  try {
    return el.matches(":focus-visible");
  } catch {
    return true;
  }
}
