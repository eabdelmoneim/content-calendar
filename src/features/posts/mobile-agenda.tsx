"use client";

import { useState } from "react";
import { Skeleton } from "@/shared/peacock/ui";
import { displaySpec, shortDay, type CalendarEntry, type GridDay } from "./calendar-model";
import styles from "./scheduler.module.css";

/**
 * Mobile agenda (SCREENS.md › Posts › Mobile): a week strip with status dots,
 * then posts grouped by day. Tapping a day in the strip jumps to it.
 */
export function MobileAgenda({
  days,
  today,
  byDate,
  loading,
  renderCard,
}: {
  days: readonly GridDay[];
  today: string;
  byDate: Map<string, CalendarEntry[]>;
  loading: boolean;
  renderCard: (entry: CalendarEntry) => React.JSX.Element;
}): React.JSX.Element {
  const [focusDay, setFocusDay] = useState<string | null>(null);
  return (
    <div className={styles.agenda}>
      <div className={styles.weekStrip} role="group" aria-label="Days">
        {days.map((day) => {
          const list = byDate.get(day.date) ?? [];
          return (
            <button
              key={day.date}
              type="button"
              className={styles.stripDay}
              data-today={day.date === today || undefined}
              aria-current={day.date === today ? "date" : undefined}
              aria-label={`${shortDay(day.date)}, ${list.length} ${list.length === 1 ? "post" : "posts"}`}
              onClick={() => {
                setFocusDay(day.date);
                document
                  .getElementById(`agenda-${day.date}`)
                  ?.scrollIntoView?.({ block: "start" });
              }}
            >
              <span className={styles.stripDow}>
                {shortDay(day.date).slice(0, 3)}
              </span>
              <span className={styles.stripNum}>{Number(day.date.slice(8))}</span>
              <span className={styles.stripDots} aria-hidden>
                {list.slice(0, 3).map((entry) => (
                  <span
                    key={entry.key}
                    className={styles.stripDot}
                    data-status={displaySpec(entry.status).chip}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>
      <div className={styles.agendaList} aria-busy={loading || undefined}>
        {loading
          ? Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} height={72} radius="md" />
            ))
          : days.map((day) => {
              const list = byDate.get(day.date) ?? [];
              if (list.length === 0 && day.date !== today && day.date !== focusDay)
                return null;
              return (
                <section
                  key={day.date}
                  id={`agenda-${day.date}`}
                  className={styles.agendaDay}
                  aria-label={shortDay(day.date)}
                >
                  <h3 className={styles.agendaHeading}>
                    {shortDay(day.date)}
                    {day.date === today ? " · Today" : ""}
                  </h3>
                  {list.length === 0 ? (
                    <p className={styles.agendaEmpty}>Nothing planned.</p>
                  ) : (
                    list.map(renderCard)
                  )}
                </section>
              );
            })}
      </div>
    </div>
  );
}
