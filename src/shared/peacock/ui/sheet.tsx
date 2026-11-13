"use client";

import { X } from "lucide-react";
import type { KeyboardEvent, ReactNode, RefObject } from "react";
import { useEffect, useEffectEvent, useId, useRef } from "react";
import { cx, ICON_SIZE, ICON_STROKE } from "./cx";
import { focusableIn } from "./focus";
import { IconButton } from "./icon-button";
import { ModalSurface } from "./modal";
import styles from "./sheet.module.css";

export type SheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  /** Small tabular count after the title, e.g. number of ideas. */
  count?: number;
  /** `right`: side sheet (Ideas, asset detail). `bottom`: mobile sheet. */
  side?: "right" | "bottom";
  /**
   * Right-sheet width in px: 320 (default) or 440 (lead drawer). Both cap
   * at the viewport width.
   */
  width?: 320 | 440;
  /**
   * `true` (default): modal, with backdrop, focus trap and scroll lock.
   * `false`: a non-modal side panel (right side only). No backdrop and no
   * trap, so the page behind stays usable; focus moves in on open, Escape
   * inside closes, and focus returns to the opener unless the person has
   * already moved it elsewhere.
   */
  modal?: boolean;
  /** Leading media in the header, e.g. a 48px Avatar. */
  media?: ReactNode;
  /** Lines under the title (role · company, location). */
  subtitle?: ReactNode;
  /** A row under the title block, e.g. the drawer's primary actions. */
  headerExtra?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  closeLabel?: string;
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Extra classes for the panel, the scrolling body and the pinned footer. */
  className?: string;
  bodyClassName?: string;
  footerClassName?: string;
};

/**
 * Side or bottom sheet (COMPONENTS.md › Sheet). Modal by default, Esc closes.
 * The non-modal panel is `position: fixed` to the right edge; set
 * `--sheet-top` on an ancestor (e.g. `var(--topbar-h)`) to start it below
 * the top bar.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  count,
  side = "right",
  width = 320,
  modal = true,
  media,
  subtitle,
  headerExtra,
  footer,
  children,
  closeLabel = "Close",
  initialFocusRef,
  className,
  bodyClassName,
  footerClassName,
}: SheetProps): React.JSX.Element | null {
  const titleId = useId();
  if (!open) return null;

  const rich = Boolean(media || subtitle || headerExtra);
  const content = (
    <>
      {side === "bottom" ? (
        <span className={styles.handle} aria-hidden />
      ) : null}
      <header className={cx(styles.header, rich && styles.richHeader)}>
        <div className={styles.headerMain}>
          {media ? <span className={styles.media}>{media}</span> : null}
          <div className={styles.titleBlock}>
            <h2
              id={titleId}
              className={cx(styles.title, rich && styles.richTitle)}
            >
              {title}
              {count !== undefined ? (
                <span className={styles.count}>{count}</span>
              ) : null}
            </h2>
            {subtitle ? (
              <div className={styles.subtitle}>{subtitle}</div>
            ) : null}
          </div>
          <IconButton
            aria-label={closeLabel}
            size="sm"
            icon={<X size={ICON_SIZE} strokeWidth={ICON_STROKE} />}
            onClick={() => onOpenChange(false)}
          />
        </div>
        {headerExtra ? (
          <div className={styles.headerExtra}>{headerExtra}</div>
        ) : null}
      </header>
      <div className={cx(styles.body, bodyClassName)}>{children}</div>
      {footer ? (
        <footer className={cx(styles.footer, footerClassName)}>{footer}</footer>
      ) : null}
    </>
  );

  const widthClass = width === 440 ? styles.w440 : undefined;

  if (!modal && side === "right") {
    return (
      <SidePanel
        onClose={() => onOpenChange(false)}
        labelledBy={titleId}
        initialFocusRef={initialFocusRef}
        className={cx(styles.panel, styles.sidePanel, widthClass, className)}
      >
        {content}
      </SidePanel>
    );
  }

  return (
    <ModalSurface
      onClose={() => onOpenChange(false)}
      labelledBy={titleId}
      initialFocusRef={initialFocusRef}
      layoutClassName={cx(styles.layout, styles[`${side}Layout`])}
      panelClassName={cx(
        styles.panel,
        styles[side],
        side === "right" && widthClass,
        className,
      )}
    >
      {content}
    </ModalSurface>
  );
}

function SidePanel({
  onClose,
  labelledBy,
  initialFocusRef,
  className,
  children,
}: {
  onClose: () => void;
  labelledBy: string;
  initialFocusRef?: RefObject<HTMLElement | null>;
  className?: string;
  children: ReactNode;
}): React.JSX.Element {
  const panelRef = useRef<HTMLDivElement>(null);
  const focusInitial = useEffectEvent(() => {
    const target = initialFocusRef?.current ?? focusableIn(panelRef.current)[0];
    (target ?? panelRef.current)?.focus();
  });

  useEffect(() => {
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    focusInitial();
    return () => {
      // The panel is already detached here. If focus went down with it,
      // send it back to the opener; if the person moved focus elsewhere
      // (e.g. clicked another row), leave it there.
      const active = document.activeElement;
      const lost = !active || active === document.body;
      if (lost && opener?.isConnected) opener.focus();
    };
  }, []);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
  }

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-labelledby={labelledBy}
      tabIndex={-1}
      className={className}
      onKeyDown={onKeyDown}
    >
      {children}
    </div>
  );
}
