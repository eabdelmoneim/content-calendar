"use client";

import { Check } from "lucide-react";
import type {
  ButtonHTMLAttributes,
  KeyboardEvent,
  ReactNode,
  Ref,
} from "react";
import {
  forwardRef,
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
} from "react";
import { cx } from "./cx";
import { focusableIn } from "./focus";
import styles from "./popover.module.css";

export type PopoverTriggerProps = {
  ref: Ref<HTMLButtonElement>;
  onClick: () => void;
  "aria-expanded": boolean;
  "aria-controls": string;
  "aria-haspopup": "dialog" | "menu";
};

export type PopoverProps = {
  /** Render the trigger and spread the given props onto a button. */
  trigger: (props: PopoverTriggerProps) => ReactNode;
  children: ReactNode;
  /** Accessible name of the popover surface. */
  label: string;
  /** `menu` gives arrow-key navigation over PopoverMenuItem children. */
  role?: "dialog" | "menu";
  align?: "start" | "end";
  /** Opens below the trigger (default) or above it (bottom bars, footers). */
  side?: "bottom" | "top";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
};

/**
 * Anchored floating surface (COMPONENTS.md › Popover). Non-modal: Escape and
 * outside clicks close it and focus returns to the trigger.
 */
export function Popover({
  trigger,
  children,
  label,
  role = "dialog",
  align = "start",
  side = "bottom",
  open: controlledOpen,
  onOpenChange,
  className,
}: PopoverProps): React.JSX.Element {
  const id = useId();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const rootRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  function setOpen(next: boolean): void {
    if (controlledOpen === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  }
  const closeFromOutside = useEffectEvent(() => setOpen(false));

  // Move focus into the panel on open.
  useEffect(() => {
    if (!open) return;
    const first = focusableIn(panelRef.current)[0];
    (first ?? panelRef.current)?.focus();
  }, [open]);

  // Outside pointer closes without stealing focus back.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent | MouseEvent): void {
      if (!rootRef.current?.contains(event.target as Node)) {
        closeFromOutside();
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  function close(returnFocus: boolean): void {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(true);
      return;
    }
    if (event.key === "Tab" && role === "menu") {
      close(false);
      return;
    }
    if (role !== "menu") return;
    const items = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>(
        '[role="menuitem"]:not([disabled]), [role="menuitemradio"]:not([disabled]), [role="menuitemcheckbox"]:not([disabled])',
      ) ?? [],
    );
    if (items.length === 0) return;
    const index = items.indexOf(document.activeElement as HTMLElement);
    let next = -1;
    if (event.key === "ArrowDown") next = (index + 1) % items.length;
    else if (event.key === "ArrowUp")
      next = (index - 1 + items.length) % items.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    if (next >= 0) {
      event.preventDefault();
      items[next].focus();
    }
  }

  return (
    <span ref={rootRef} className={styles.anchor}>
      {trigger({
        ref: triggerRef,
        onClick: () => setOpen(!open),
        "aria-expanded": open,
        "aria-controls": id,
        "aria-haspopup": role,
      })}
      {open ? (
        <div
          ref={panelRef}
          id={id}
          role={role}
          aria-label={label}
          tabIndex={-1}
          className={cx(
            styles.panel,
            styles[align],
            side === "top" && styles.top,
            className,
          )}
          onKeyDown={onKeyDown}
        >
          {children}
        </div>
      ) : null}
    </span>
  );
}

export type PopoverMenuItemProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode;
  /** Trailing secondary text, e.g. a count or "Always shown". */
  meta?: ReactNode;
};

/** 32px menu row for role="menu" popovers. */
export const PopoverMenuItem = forwardRef<
  HTMLButtonElement,
  PopoverMenuItemProps
>(function PopoverMenuItem(
  { icon, meta, className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      role="menuitem"
      tabIndex={-1}
      className={cx(styles.item, className)}
      {...rest}
    >
      <ItemBody icon={icon} meta={meta}>
        {children}
      </ItemBody>
    </button>
  );
});

function ItemBody({
  icon,
  meta,
  children,
}: {
  icon?: ReactNode;
  meta?: ReactNode;
  children?: ReactNode;
}): React.JSX.Element {
  return (
    <>
      {icon ? (
        <span className={styles.itemIcon} aria-hidden>
          {icon}
        </span>
      ) : null}
      <span className={styles.itemLabel}>{children}</span>
      {meta !== undefined && meta !== null ? (
        <span className={styles.itemMeta}>{meta}</span>
      ) : null}
    </>
  );
}

export type PopoverMenuCheckboxItemProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onChange" | "role"
> & {
  checked: boolean;
  /** Called with the next state. The menu stays open so several can toggle. */
  onCheckedChange?: (checked: boolean) => void;
  icon?: ReactNode;
  meta?: ReactNode;
};

/**
 * Multi-select menu row (role="menuitemcheckbox"): column pickers, filter
 * values. Space or Enter toggles; arrow keys move through the menu.
 */
export const PopoverMenuCheckboxItem = forwardRef<
  HTMLButtonElement,
  PopoverMenuCheckboxItemProps
>(function PopoverMenuCheckboxItem(
  {
    checked,
    onCheckedChange,
    icon,
    meta,
    className,
    children,
    onClick,
    type = "button",
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      role="menuitemcheckbox"
      aria-checked={checked}
      tabIndex={-1}
      className={cx(styles.item, className)}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) onCheckedChange?.(!checked);
      }}
      {...rest}
    >
      <span className={cx(styles.box, checked && styles.boxOn)} aria-hidden>
        {checked ? <Check size={10} strokeWidth={3} /> : null}
      </span>
      <ItemBody icon={icon} meta={meta}>
        {children}
      </ItemBody>
    </button>
  );
});

export type PopoverMenuRadioItemProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "role" | "onSelect"
> & {
  checked: boolean;
  /** Called when this option is chosen (not when it is already checked). */
  onSelect?: () => void;
  icon?: ReactNode;
  meta?: ReactNode;
};

/**
 * Single-select menu row (role="menuitemradio"): sort order, active ICP,
 * saved view. Wrap a set in PopoverMenuGroup so they read as one group.
 */
export const PopoverMenuRadioItem = forwardRef<
  HTMLButtonElement,
  PopoverMenuRadioItemProps
>(function PopoverMenuRadioItem(
  {
    checked,
    onSelect,
    icon,
    meta,
    className,
    children,
    onClick,
    type = "button",
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      role="menuitemradio"
      aria-checked={checked}
      tabIndex={-1}
      className={cx(styles.item, checked && styles.itemChecked, className)}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented && !checked) onSelect?.();
      }}
      {...rest}
    >
      <ItemBody icon={icon} meta={meta}>
        {children}
      </ItemBody>
      <span className={styles.radioMark} aria-hidden>
        {checked ? <Check size={14} strokeWidth={2} /> : null}
      </span>
    </button>
  );
});

export type PopoverMenuGroupProps = {
  /** Visible overline label, also the group's accessible name. */
  label?: string;
  children: ReactNode;
  className?: string;
};

/** Groups related menu items under an optional 11px overline label. */
export function PopoverMenuGroup({
  label,
  children,
  className,
}: PopoverMenuGroupProps): React.JSX.Element {
  const id = useId();
  return (
    <div
      role="group"
      aria-labelledby={label ? id : undefined}
      className={className}
    >
      {label ? (
        <div id={id} className={styles.groupLabel}>
          {label}
        </div>
      ) : null}
      {children}
    </div>
  );
}

/** Hairline between menu sections. */
export function PopoverMenuSeparator(): React.JSX.Element {
  return <div role="separator" className={styles.separator} />;
}
