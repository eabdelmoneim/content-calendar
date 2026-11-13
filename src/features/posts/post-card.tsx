"use client";

import type { DragEvent, KeyboardEvent } from "react";
import { Avatar, CHIP_STATUS_MAP, StatusChip, cx } from "@/shared/peacock/ui";
import { displaySpec, type CalendarEntry } from "./calendar-model";
import { PlatformIcon, platformName } from "./platform-icon";
import styles from "./post-card.module.css";

export type PostCardProps = {
  entry: CalendarEntry;
  authorName: string;
  authorImageUrl?: string;
  /** month: compact two rows; full: 2-week cells and agenda; week: absolute in hour grid. */
  mode: "month" | "full" | "week";
  /** Readable date for the accessible name, e.g. "Thu, Oct 29". */
  dayLabel: string;
  top?: number;
  onOpen: (opener: HTMLElement) => void;
  onDragStart?: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd?: () => void;
};

const ATTENTION_TEXT: Partial<Record<CalendarEntry["status"], string>> = {
  overdue: "Due · not marked posted",
  needs_approval: "Waiting for approval",
};

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

/** Calendar post card (Peacock COMPONENTS.md › PostCard). */
export function PostCard({
  entry,
  authorName,
  authorImageUrl,
  mode,
  dayLabel,
  top,
  onOpen,
  onDragStart,
  onDragEnd,
}: PostCardProps): React.JSX.Element {
  const display = displaySpec(entry.status);
  const spec = CHIP_STATUS_MAP[display.chip];
  const Icon = spec.icon && typeof spec.icon !== "string" ? spec.icon : null;
  const attention = mode === "month" ? ATTENTION_TEXT[entry.status] : undefined;
  const ariaLabel = [
    entry.title,
    `${dayLabel} ${entry.time}`,
    authorName,
    platformName(entry.platform),
    display.label,
  ].join(", ");

  return (
    <div
      role="button"
      tabIndex={0}
      draggable={entry.movable && Boolean(onDragStart)}
      aria-label={ariaLabel}
      data-status={display.chip}
      data-mode={mode}
      data-platform={entry.platform}
      className={cx(styles.card, styles[mode])}
      style={top === undefined ? undefined : { top }}
      onClick={(event) => {
        event.stopPropagation();
        onOpen(event.currentTarget);
      }}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(event.currentTarget);
        }
      }}
    >
      <span className={styles.meta} aria-hidden>
        <Avatar name={authorName} src={authorImageUrl} size={16} decorative />
        <PlatformIcon platform={entry.platform} size={11} />
        <span className={styles.time}>{entry.time}</span>
        {mode !== "week" ? <span className={styles.who}>· {firstName(authorName)}</span> : null}
        <span className={styles.spacer} />
        {mode === "month" && Icon ? (
          <span className={cx(styles.statusIcon, styles[spec.tone])} title={display.label}>
            <Icon size={12} strokeWidth={2} aria-hidden />
          </span>
        ) : null}
      </span>
      <span className={styles.titleRow} aria-hidden>
        <span className={styles.title}>{entry.title}</span>
      </span>
      {attention ? (
        <span className={styles.attention} aria-hidden>
          {attention}
        </span>
      ) : null}
      {mode !== "month" ? (
        <span className={styles.chipRow} aria-hidden>
          <StatusChip status={display.chip} label={display.label} />
        </span>
      ) : null}
    </div>
  );
}
