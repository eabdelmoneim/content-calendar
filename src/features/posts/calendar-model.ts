/**
 * Pure calendar model for the Posts scheduler (ported from Peacock's
 * calendar-model.ts): turns posts into calendar entries, applies the Filters
 * popover, and does the date arithmetic for views and moves.
 *
 * Dates are local calendar dates ("YYYY-MM-DD") and 24h clocks ("HH:MM") in
 * this device's time zone; the server stores instants.
 *
 * No React here so the rules stay easy to test.
 */
import type { ChipStatus } from "@/shared/peacock/ui";
import { assertNever } from "@/lib/assert";
import type { Platform, Post } from "@/lib/types";

export type { Platform };

export type CalendarView = "month" | "two-week" | "week" | "day";

/**
 * What a post shows as on cards, chips and filters. Approval is separate from
 * the post state on the server; here it is folded into one readable status.
 */
export const DISPLAY_STATUSES = [
  "draft",
  "needs_approval",
  "approved",
  "overdue",
  "published",
] as const;
export type DisplayStatus = (typeof DISPLAY_STATUSES)[number];

export type DisplaySpec = { chip: ChipStatus; label: string };

export function displaySpec(status: DisplayStatus): DisplaySpec {
  switch (status) {
    case "draft":
      return { chip: "idea", label: "Draft" };
    case "needs_approval":
      return { chip: "in_review", label: "Needs approval" };
    case "approved":
      return { chip: "scheduled", label: "Approved" };
    case "overdue":
      return { chip: "deferred", label: "Due · not posted" };
    case "published":
      return { chip: "published", label: "Posted" };
    default:
      return assertNever(status);
  }
}

export function displayStatus(post: Post, nowMs: number): DisplayStatus {
  switch (post.status) {
    case "draft":
      return "draft";
    case "published":
      return "published";
    case "scheduled": {
      const due = post.scheduledAt ? Date.parse(post.scheduledAt) <= nowMs : false;
      if (due) return "overdue";
      return post.approvedAt ? "approved" : "needs_approval";
    }
    default:
      return assertNever(post.status);
  }
}

export type CalendarEntry = {
  /** Stable React key and drag payload id. */
  key: string;
  post: Post;
  platform: Platform;
  profileId: string;
  /** Local calendar date (YYYY-MM-DD). */
  date: string;
  /** 24h clock "HH:MM". */
  time: string;
  title: string;
  status: DisplayStatus;
  /** Drag move is allowed (not yet posted). */
  movable: boolean;
};

/** The statuses the Filters popover offers, in its order. */
export const FILTER_STATUSES: readonly DisplayStatus[] = [
  "needs_approval",
  "approved",
  "overdue",
  "published",
];

export type CalendarFilters = {
  statuses: readonly DisplayStatus[];
  platforms: readonly Platform[];
};

export const EMPTY_FILTERS: CalendarFilters = { statuses: [], platforms: [] };

/** Drafts dropped onto a day land at this local time (Peacock's idea drop). */
export const DRAFT_DROP_TIME = "09:00";

const pad = (value: number): string => String(value).padStart(2, "0");

export function dateKey(day: Date): string {
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
}

export function parseDate(date: string): Date {
  const [year = 1970, month = 1, day = 1] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** Local date and clock of an instant. */
export function clock(iso: string): { date: string; time: string } {
  const at = new Date(iso);
  return { date: dateKey(at), time: `${pad(at.getHours())}:${pad(at.getMinutes())}` };
}

/** ISO instant of a local date + clock. */
export function toInstant(date: string, time: string): string {
  const [hours = 0, minutes = 0] = time.split(":").map(Number);
  const day = parseDate(date);
  day.setHours(hours, minutes, 0, 0);
  return day.toISOString();
}

export function todayKey(): string {
  return dateKey(new Date());
}

/** First line of the text, or "Untitled post". */
export function postTitle(text: string): string {
  const line = text
    .split("\n")
    .map((part) => part.trim())
    .find((part) => part.length > 0);
  return line ?? "Untitled post";
}

export function buildEntries(posts: readonly Post[], nowMs: number): CalendarEntry[] {
  const entries: CalendarEntry[] = [];
  for (const post of posts) {
    const at = post.status === "published" ? (post.publishedAt ?? post.scheduledAt) : post.scheduledAt;
    if (post.status === "draft" || !at) continue;
    const { date, time } = clock(at);
    entries.push({
      key: post.id,
      post,
      platform: post.platform,
      profileId: post.profileId,
      date,
      time,
      title: postTitle(post.contentText),
      status: displayStatus(post, nowMs),
      movable: post.status === "scheduled",
    });
  }
  return entries.sort(
    (left, right) =>
      left.date.localeCompare(right.date) ||
      left.time.localeCompare(right.time) ||
      left.key.localeCompare(right.key),
  );
}

export function filterCount(filters: CalendarFilters): number {
  return filters.statuses.length + filters.platforms.length;
}

export function matchesFilters(entry: CalendarEntry, filters: CalendarFilters): boolean {
  if (filters.statuses.length > 0 && !filters.statuses.includes(entry.status)) return false;
  if (filters.platforms.length > 0 && !filters.platforms.includes(entry.platform)) return false;
  return true;
}

export function toggleIn<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export function groupByDate(entries: readonly CalendarEntry[]): Map<string, CalendarEntry[]> {
  const grouped = new Map<string, CalendarEntry[]>();
  for (const entry of entries) {
    const rows = grouped.get(entry.date) ?? [];
    rows.push(entry);
    grouped.set(entry.date, rows);
  }
  return grouped;
}

export type GridDay = { date: string; inRange: boolean; weekend: boolean };

/** ISO weekday: Monday 1 … Sunday 7. */
function isoDay(day: Date): number {
  return day.getDay() === 0 ? 7 : day.getDay();
}

export function addDays(date: string, days: number): string {
  const day = parseDate(date);
  day.setDate(day.getDate() + days);
  return dateKey(day);
}

/**
 * The days a view draws. Month pads to whole Monday-first weeks (out-of-month
 * days included so they can still be read and dropped on); 2 weeks and Week
 * start on the Monday of the anchor's week.
 */
export function gridDays(anchorDate: string, view: CalendarView): GridDay[] {
  const anchor = parseDate(anchorDate);
  if (view === "month") {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    const start = dateKey(first);
    const from = addDays(start, -(isoDay(first) - 1));
    const to = addDays(dateKey(last), 7 - isoDay(last));
    const days: GridDay[] = [];
    for (let date = from; date <= to; date = addDays(date, 1)) {
      const day = parseDate(date);
      days.push({ date, inRange: day.getMonth() === first.getMonth(), weekend: isoDay(day) >= 6 });
    }
    return days;
  }
  if (view === "day") return [{ date: anchorDate, inRange: true, weekend: isoDay(anchor) >= 6 }];
  const start = addDays(anchorDate, -(isoDay(anchor) - 1));
  const length = view === "two-week" ? 14 : 7;
  return Array.from({ length }, (_, index) => {
    const date = addDays(start, index);
    return { date, inRange: true, weekend: isoDay(parseDate(date)) >= 6 };
  });
}

export function moveAnchorDate(anchorDate: string, view: CalendarView, direction: -1 | 1): string {
  switch (view) {
    case "month": {
      const anchor = parseDate(anchorDate);
      return dateKey(new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1));
    }
    case "two-week":
      return addDays(anchorDate, 14 * direction);
    case "week":
      return addDays(anchorDate, 7 * direction);
    case "day":
      return addDays(anchorDate, direction);
    default:
      return assertNever(view);
  }
}

const utcNoon = (date: string): Date => {
  const [year = 1970, month = 1, day = 1] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
};

const DAY_FORMAT = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** "2026-10-29" → "Thu, Oct 29". */
export function shortDay(date: string): string {
  return DAY_FORMAT.format(utcNoon(date));
}

/** "Thu, Oct 29 · 09:00", the move toast and hint wording. */
export function whenLabel(date: string, time: string): string {
  return `${shortDay(date)} · ${time}`;
}

const MONTH_FORMAT = new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" });

/** Month name of the anchor, for "Nothing planned for November". */
export function monthName(date: string): string {
  return MONTH_FORMAT.format(utcNoon(date));
}

export function rangeLabel(days: readonly GridDay[], view: CalendarView): string {
  const inRange = days.filter((day) => day.inRange);
  const first = inRange[0]?.date ?? days[0]?.date ?? "1970-01-01";
  const last = inRange.at(-1)?.date ?? first;
  if (view === "month")
    return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(
      utcNoon(first),
    );
  if (view === "day")
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(utcNoon(first));
  const short = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const long = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${short.format(utcNoon(first))} – ${long.format(utcNoon(last))}`;
}

/** Minutes after midnight for an "HH:MM" clock. */
export function minutesOf(time: string): number {
  const [hours = "0", minutes = "0"] = time.split(":");
  return Number(hours) * 60 + Number(minutes);
}

/** The week view draws all 24 hours and opens scrolled to WEEK_SCROLL_HOUR. */
export const WEEK_HOURS = 24;
export const WEEK_SCROLL_HOUR = 7;
export const WEEK_HOUR_HEIGHT = 52;
/** Week cards are 72px tall; later cards at a similar time step down this far. */
export const WEEK_CARD_HEIGHT = 72;
const WEEK_STACK_STEP = 26;

/** Top offset in px of a time inside the week view's hour grid. */
export function weekOffset(time: string): number {
  return (minutesOf(time) / 60) * WEEK_HOUR_HEIGHT;
}

/**
 * Top offsets for one day's (time-sorted) cards: at their time, but never
 * fully covering the card before, so every card keeps a clickable strip.
 */
export function weekTops(times: readonly string[]): number[] {
  const max = WEEK_HOURS * WEEK_HOUR_HEIGHT - WEEK_CARD_HEIGHT;
  const tops: number[] = [];
  for (const time of times) {
    const previous = tops.at(-1);
    const natural = weekOffset(time);
    tops.push(Math.min(previous === undefined ? natural : Math.max(natural, previous + WEEK_STACK_STEP), max));
  }
  return tops;
}

/** Clock for a click at `offsetY` px in the week grid, snapped to 15 minutes. */
export function timeAtOffset(offsetY: number): string {
  const minutes = Math.max(0, Math.min(23 * 60 + 45, Math.floor((offsetY / WEEK_HOUR_HEIGHT) * 4) * 15));
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/** Next quarter hour from now, for "today" slots. */
export function nextQuarterHour(): string {
  const now = new Date();
  const minutes = Math.min(23 * 60 + 45, Math.ceil((now.getHours() * 60 + now.getMinutes() + 1) / 15) * 15);
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

const RELATIVE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

export function relativeUpdated(at: string, now: number): string {
  const minutes = Math.round((now - Date.parse(at)) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  if (hours < 48) return "Yesterday";
  return RELATIVE.format(new Date(at));
}
