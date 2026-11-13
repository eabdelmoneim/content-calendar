"use client";

import { CalendarPlus, ChevronLeft, ChevronRight, FilePen, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent } from "react";
import {
  Button,
  EmptyState,
  IconButton,
  InlineAlert,
  Segmented,
  Skeleton,
  cx,
  useToast,
} from "@/shared/peacock/ui";
import { useSavePost } from "@/lib/api";
import type { Post, PostInput, Profile } from "@/lib/types";
import {
  DRAFT_DROP_TIME,
  EMPTY_FILTERS,
  WEEK_HOURS,
  WEEK_HOUR_HEIGHT,
  WEEK_SCROLL_HOUR,
  buildEntries,
  gridDays,
  groupByDate,
  matchesFilters,
  minutesOf,
  monthName,
  moveAnchorDate,
  nextQuarterHour,
  rangeLabel,
  shortDay,
  timeAtOffset,
  toInstant,
  todayKey,
  weekTops,
  whenLabel,
  type CalendarEntry,
  type CalendarFilters,
  type CalendarView,
  type GridDay,
} from "./calendar-model";
import { DayView } from "./day-view";
import { DRAFT_DRAG_TYPE, DraftsPanel } from "./drafts-panel";
import { FiltersPopover } from "./filters-popover";
import { MobileAgenda } from "./mobile-agenda";
import { PostCard } from "./post-card";
import { POSTS_MOBILE_QUERY, useMediaQuery } from "./use-media-query";
import styles from "./scheduler.module.css";

export type ComposeRequest =
  | { kind: "new"; date?: string; time?: string }
  | { kind: "edit"; post: Post };

export type SchedulerProps = {
  /** Posts of the selected profiles (all states). */
  posts: readonly Post[];
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
  profiles: readonly Profile[];
  noSelection: boolean;
  anchorDate: string;
  onAnchorDateChange: (date: string) => void;
  onCompose: (request: ComposeRequest, opener?: HTMLElement) => void;
};

const POST_DRAG_TYPE = "application/x-content-calendar-post";
/** Space kept above the first visible hour line for its label. */
const WEEK_SCROLL_LABEL_ROOM = 12;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const VIEW_OPTIONS: { value: CalendarView; label: string }[] = [
  { value: "month", label: "Month" },
  { value: "two-week", label: "2 weeks" },
  { value: "week", label: "Week" },
  { value: "day", label: "Day" },
];

/** grabY: px from the dragged card's top to the pointer, so a week drop lands where the card's top is. */
type DragSource = { kind: "entry"; entry: CalendarEntry; grabY: number } | { kind: "draft"; draft: Post };

type DropProps = {
  onDragOver: (event: DragEvent<HTMLElement>) => void;
  onDragLeave: (event: DragEvent<HTMLElement>) => void;
  onDrop: (event: DragEvent<HTMLElement>) => void;
};

/** Week columns turn the drop point into a time; month cells and the day view keep the post's time. */
type DropTime = (event: DragEvent<HTMLElement>, grabY: number) => string;

/** Read at event time only (never during render). */
function wallClock(): number {
  return Date.now();
}

function nowMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function inputOf(post: Post, scheduledAt: string | null): PostInput {
  return {
    profileId: post.profileId,
    platform: post.platform,
    contentHtml: post.contentHtml,
    contentText: post.contentText,
    scheduledAt,
    assetIds: post.assetIds,
    mediaLinks: post.mediaLinks,
  };
}

/** Default clock for a new post on `date`: 09:00, or the next quarter hour today. */
function slotTime(date: string, today: string): string {
  if (date !== today) return DRAFT_DROP_TIME;
  const next = nextQuarterHour();
  return minutesOf(next) > minutesOf(DRAFT_DROP_TIME) ? next : DRAFT_DROP_TIME;
}

/** Calendar view with toolbar, filters, drafts and drag moves (Peacock's Scheduler). */
export function Scheduler({
  posts,
  loading,
  error,
  onRetry,
  profiles,
  noSelection,
  anchorDate,
  onAnchorDateChange,
  onCompose,
}: SchedulerProps): React.JSX.Element {
  const toast = useToast();
  const save = useSavePost();
  const mobile = useMediaQuery(POSTS_MOBILE_QUERY);
  const [chosenView, setView] = useState<CalendarView>("month");
  const view: CalendarView = mobile ? "week" : chosenView;
  const [filters, setFilters] = useState<CalendarFilters>(EMPTY_FILTERS);
  const [draftsOpen, setDraftsOpen] = useState(false);
  const draftsButtonRef = useRef<HTMLButtonElement>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const dragSource = useRef<DragSource | null>(null);
  const movePending = useRef(false);
  const weekScrollRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState<{ date: string; minutes: number; ms: number } | null>(null);

  // The wall clock is read after mount (stable hydration) and once a minute.
  useEffect(() => {
    const tick = () => setNow({ date: todayKey(), minutes: nowMinutes(), ms: Date.now() });
    const frame = requestAnimationFrame(tick);
    const timer = setInterval(tick, 60_000);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(timer);
    };
  }, []);

  const today = now?.date ?? anchorDate;
  const days = useMemo(() => gridDays(anchorDate, view), [anchorDate, view]);
  const dayDates = useMemo(() => new Set(days.map((day) => day.date)), [days]);
  const allEntries = useMemo(
    () => (now ? buildEntries(posts, now.ms).filter((entry) => dayDates.has(entry.date)) : []),
    [posts, now, dayDates],
  );
  const entries = useMemo(() => allEntries.filter((entry) => matchesFilters(entry, filters)), [allEntries, filters]);
  const byDate = useMemo(() => groupByDate(entries), [entries]);
  const drafts = useMemo(
    () =>
      posts
        .filter((post) => post.status === "draft")
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    [posts],
  );
  const profileById = useMemo(() => new Map(profiles.map((profile) => [profile.id, profile])), [profiles]);

  useEffect(() => {
    if (view === "week" && weekScrollRef.current)
      // Leave room above the first visible hour so its label isn't clipped.
      weekScrollRef.current.scrollTop = WEEK_SCROLL_HOUR * WEEK_HOUR_HEIGHT - WEEK_SCROLL_LABEL_ROOM;
  }, [view, anchorDate]);

  const authorName = (profileId: string): string => profileById.get(profileId)?.name ?? "Unknown account";
  const authorImage = (profileId: string): string | undefined => profileById.get(profileId)?.avatarUrl ?? undefined;

  function composeAt(opener: HTMLElement | undefined, date?: string, time?: string): void {
    onCompose(date ? { kind: "new", date, time: time ?? slotTime(date, today) } : { kind: "new" }, opener);
  }

  function showError(message: string): void {
    toast.show({ message, tone: "danger" });
    setAnnouncement(message);
  }

  async function reschedule(post: Post, date: string, time: string, undoTo: string | null): Promise<void> {
    if (movePending.current) return;
    if (date < today) {
      showError("Choose today or a future day.");
      return;
    }
    const at = toInstant(date, time);
    if (Date.parse(at) <= wallClock()) {
      showError("That time has already passed on this day. Choose a later day, or open the post to change its time.");
      return;
    }
    movePending.current = true;
    try {
      await save.mutateAsync({ id: post.id, input: inputOf(post, at) });
      const message = `Post moved to ${whenLabel(date, time)}`;
      setAnnouncement(message);
      toast.show({
        message,
        action: {
          label: "Undo",
          onAction: () => {
            save.mutateAsync({ id: post.id, input: inputOf(post, undoTo) }).then(
              () => setAnnouncement("Move undone."),
              (caught: unknown) => showError(caught instanceof Error ? caught.message : "The move could not be undone."),
            );
          },
        },
      });
    } catch (caught) {
      showError(caught instanceof Error ? caught.message : "The post could not be moved.");
    } finally {
      movePending.current = false;
    }
  }

  function showDay(date: string): void {
    onAnchorDateChange(date);
    setView("day");
  }

  function dropProps(date: string, enabled: boolean, timeAt?: DropTime): DropProps {
    return {
      onDragOver: (event: DragEvent<HTMLElement>) => {
        const types = event.dataTransfer.types;
        if (!types.includes(POST_DRAG_TYPE) && !types.includes(DRAFT_DRAG_TYPE)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = enabled ? "move" : "none";
        if (enabled && dragOver !== date) setDragOver(date);
      },
      onDragLeave: (event: DragEvent<HTMLElement>) => {
        if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
        if (dragOver === date) setDragOver(null);
      },
      onDrop: (event: DragEvent<HTMLElement>) => {
        const source = dragSource.current;
        if (!source) return;
        event.preventDefault();
        setDragOver(null);
        dragSource.current = null;
        if (!enabled) return;
        if (source.kind === "draft") {
          void reschedule(source.draft, date, timeAt ? timeAt(event, 0) : DRAFT_DROP_TIME, null);
          return;
        }
        const time = timeAt ? timeAt(event, source.grabY) : source.entry.time;
        if (date !== source.entry.date || time !== source.entry.time)
          void reschedule(source.entry.post, date, time, source.entry.post.scheduledAt);
      },
    };
  }

  function cardFor(entry: CalendarEntry, mode: "month" | "full" | "week", top?: number): React.JSX.Element {
    return (
      <PostCard
        key={entry.key}
        entry={entry}
        authorName={authorName(entry.profileId)}
        authorImageUrl={authorImage(entry.profileId)}
        mode={mode}
        dayLabel={shortDay(entry.date)}
        top={top}
        onOpen={(opener) => onCompose({ kind: "edit", post: entry.post }, opener)}
        {...(entry.movable
          ? {
              onDragStart: (event: DragEvent<HTMLDivElement>) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData(POST_DRAG_TYPE, entry.key);
                const grabY = event.clientY - event.currentTarget.getBoundingClientRect().top;
                dragSource.current = { kind: "entry", entry, grabY };
              },
              onDragEnd: () => {
                dragSource.current = null;
                setDragOver(null);
              },
            }
          : {})}
      />
    );
  }

  const shown = entries.length;
  const total = allEntries.length;
  const busy = loading || now === null;
  const monthEmpty = !busy && !error && view === "month" && total === 0 && !noSelection;
  const label = rangeLabel(days, view);

  const toolbar = (
    <div className={styles.toolbar}>
      <Button size="sm" onClick={() => onAnchorDateChange(todayKey())}>
        Today
      </Button>
      <IconButton
        aria-label={`Previous ${view === "two-week" ? "2 weeks" : view}`}
        size="sm"
        icon={<ChevronLeft size={16} strokeWidth={1.75} />}
        onClick={() => onAnchorDateChange(moveAnchorDate(anchorDate, view, -1))}
      />
      <IconButton
        aria-label={`Next ${view === "two-week" ? "2 weeks" : view}`}
        size="sm"
        icon={<ChevronRight size={16} strokeWidth={1.75} />}
        onClick={() => onAnchorDateChange(moveAnchorDate(anchorDate, view, 1))}
      />
      <h2 className={styles.rangeLabel} id="posts-range-label">
        {label}
      </h2>
      <span className={styles.toolbarSpacer} />
      <button
        ref={draftsButtonRef}
        type="button"
        aria-pressed={draftsOpen}
        className={cx(styles.toolButton, draftsOpen && styles.toolButtonOn)}
        onClick={() => setDraftsOpen((open) => !open)}
      >
        <FilePen size={14} strokeWidth={1.75} aria-hidden />
        Drafts
        <span className={styles.toolCount}>{loading ? "" : drafts.length}</span>
      </button>
      <FiltersPopover filters={filters} onChange={setFilters} shown={shown} total={total} />
      {mobile ? null : (
        <Segmented label="Calendar view" size="compact" options={VIEW_OPTIONS} value={view} onChange={setView} />
      )}
    </div>
  );

  const banners = (
    <>
      {error ? (
        <InlineAlert
          tone="danger"
          action={
            <Button size="sm" onClick={onRetry}>
              Try again
            </Button>
          }
        >
          {error.message || "Posts could not be loaded. Try again."}
        </InlineAlert>
      ) : null}
      {noSelection ? (
        <InlineAlert tone="info">No accounts are selected. Choose an account in the top bar to see posts.</InlineAlert>
      ) : null}
    </>
  );

  const draftsPanel = draftsOpen ? (
    <DraftsPanel
      drafts={drafts}
      loading={loading}
      authorName={authorName}
      authorImage={authorImage}
      onClose={() => {
        setDraftsOpen(false);
        draftsButtonRef.current?.focus();
      }}
      onNewDraft={(opener) => composeAt(opener)}
      onOpen={(draft, opener) => onCompose({ kind: "edit", post: draft }, opener)}
      onDragStart={(draft) => {
        dragSource.current = { kind: "draft", draft };
      }}
      onDragEnd={() => {
        dragSource.current = null;
        setDragOver(null);
      }}
    />
  ) : null;

  const live = (
    <p className="sr-only" aria-live="assertive" role="status">
      {announcement}
    </p>
  );

  const dayView = (
    <DayView
      date={anchorDate}
      open={anchorDate >= today}
      entries={byDate.get(anchorDate) ?? []}
      loading={busy}
      dragOver={dragOver === anchorDate}
      authorName={authorName}
      authorImage={authorImage}
      dropProps={dropProps(anchorDate, anchorDate >= today)}
      onOpen={(post, opener) => onCompose({ kind: "edit", post }, opener)}
      onCreate={(opener) => composeAt(opener, anchorDate)}
    />
  );

  if (mobile) {
    return (
      <div className={styles.mobileRoot}>
        {toolbar}
        {banners}
        <MobileAgenda
          days={days}
          today={today}
          byDate={byDate}
          loading={busy}
          renderCard={(entry) => cardFor(entry, "full")}
        />
        {draftsPanel}
        {live}
        <Button
          variant="primary"
          className={styles.fab}
          icon={<Plus size={16} aria-hidden />}
          onClick={(event) => composeAt(event.currentTarget)}
        >
          New post
        </Button>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.main}>
        {toolbar}
        {banners}
        <section className={styles.calendar} aria-labelledby="posts-range-label" aria-busy={busy || undefined}>
          {view === "day" ? (
            dayView
          ) : view === "week" ? (
            <WeekGrid
              days={days}
              today={today}
              now={now}
              byDate={byDate}
              dragOver={dragOver}
              scrollRef={weekScrollRef}
              dropProps={dropProps}
              cardFor={cardFor}
              onCreate={(date, opener, time) => composeAt(opener, date, time)}
              onShowDay={showDay}
            />
          ) : (
            <MonthGrid
              days={days}
              view={view}
              today={today}
              byDate={byDate}
              loading={busy}
              dragOver={dragOver}
              dropProps={dropProps}
              cardFor={cardFor}
              onCreate={(date, opener) => composeAt(opener, date)}
              onShowDay={showDay}
            />
          )}
          {monthEmpty ? (
            <div className={styles.emptyVeil}>
              <EmptyState
                className={styles.emptyCard}
                icon={<CalendarPlus size={20} strokeWidth={1.75} />}
                title={`Nothing planned for ${monthName(anchorDate)}`}
                body={
                  drafts.length > 0
                    ? `Write a post, or drag one of your ${drafts.length} ${drafts.length === 1 ? "draft" : "drafts"} onto a day.`
                    : "Write a post, or save a draft to plan it later."
                }
                action={
                  <span className={styles.emptyActions}>
                    <Button
                      size="sm"
                      icon={<Plus size={14} aria-hidden />}
                      onClick={(event) => composeAt(event.currentTarget)}
                    >
                      New post
                    </Button>
                    <Button size="sm" onClick={() => setDraftsOpen(true)}>
                      Open drafts
                    </Button>
                  </span>
                }
              />
            </div>
          ) : null}
        </section>
        {live}
      </div>
      {draftsPanel}
    </div>
  );
}

type GridProps = {
  days: readonly GridDay[];
  today: string;
  byDate: Map<string, CalendarEntry[]>;
  dragOver: string | null;
  dropProps: (date: string, enabled: boolean, timeAt?: DropTime) => DropProps;
  /** Opens the full-width day view. */
  onShowDay: (date: string) => void;
  cardFor: (entry: CalendarEntry, mode: "month" | "full" | "week", top?: number) => React.JSX.Element;
};

function dayNumberOf(date: string): number {
  return Number(date.slice(8, 10));
}

/** Clicks on the empty part of a cell (not on a card or a button) open the day view. */
function isEmptySlotClick(event: MouseEvent<HTMLElement>): boolean {
  const target = event.target;
  return !(target instanceof Element && target.closest("button, [role='button']"));
}

function MonthGrid({
  days,
  view,
  today,
  byDate,
  loading,
  dragOver,
  dropProps,
  cardFor,
  onCreate,
  onShowDay,
}: GridProps & {
  view: CalendarView;
  loading: boolean;
  onCreate: (date: string, opener: HTMLElement) => void;
}): React.JSX.Element {
  const max = view === "two-week" ? 3 : 2;
  const rows = Math.ceil(days.length / 7);
  return (
    <>
      <div className={styles.weekdays} aria-hidden>
        {WEEKDAYS.map((weekday) => (
          <span key={weekday}>{weekday}</span>
        ))}
      </div>
      <div
        className={cx(styles.monthGrid, view === "two-week" && styles.twoWeek)}
        style={{ gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}
        role="list"
      >
        {days.map((day, index) => {
          const list = byDate.get(day.date) ?? [];
          const past = day.date < today;
          return (
            <div
              key={day.date}
              role="listitem"
              aria-label={shortDay(day.date)}
              className={styles.cell}
              data-out={!day.inRange || undefined}
              data-weekend={day.weekend || undefined}
              data-drop={dragOver === day.date || undefined}
              data-last-col={index % 7 === 6 || undefined}
              data-open={!past || undefined}
              title="Open this day"
              onClick={(event) => {
                if (isEmptySlotClick(event)) onShowDay(day.date);
              }}
              {...dropProps(day.date, !past)}
            >
              <div className={styles.cellHead}>
                <button
                  type="button"
                  className={styles.dayNumber}
                  data-today={day.date === today || undefined}
                  aria-current={day.date === today ? "date" : undefined}
                  aria-label={`Open ${shortDay(day.date)} in day view`}
                  title="Open this day"
                  onClick={() => onShowDay(day.date)}
                >
                  {dayNumberOf(day.date)}
                </button>
                {!past ? (
                  <button
                    type="button"
                    className={styles.cellAdd}
                    aria-label={`New post on ${shortDay(day.date)}`}
                    onClick={(event) => onCreate(day.date, event.currentTarget)}
                  >
                    <Plus size={14} aria-hidden />
                  </button>
                ) : null}
              </div>
              {/* The day header and "+N more" stay pinned; only the cards
                  scroll, so a short row never hides the date or a post. */}
              <div className={styles.cellList}>
                {loading
                  ? (dayNumberOf(day.date) * 7) % 5 < 2 ? (
                      <Skeleton height={38} radius="md" />
                    ) : null
                  : list.slice(0, max).map((entry) => cardFor(entry, view === "two-week" ? "full" : "month"))}
              </div>
              {!loading && list.length > max ? (
                <button
                  type="button"
                  className={styles.more}
                  aria-label={`+${list.length - max} more, show all ${list.length} posts on ${shortDay(day.date)}`}
                  onClick={() => onShowDay(day.date)}
                >
                  +{list.length - max} more
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </>
  );
}

function WeekGrid({
  days,
  today,
  now,
  byDate,
  dragOver,
  scrollRef,
  dropProps,
  cardFor,
  onCreate,
  onShowDay,
}: GridProps & {
  now: { date: string; minutes: number } | null;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onCreate: (date: string, opener: HTMLElement, time?: string) => void;
}): React.JSX.Element {
  return (
    <>
      <div className={styles.weekHead}>
        <span />
        {days.map((day) => (
          <span key={day.date} className={styles.weekHeadDay}>
            <span className={styles.weekDow}>{shortDay(day.date).slice(0, 3)}</span>
            <button
              type="button"
              className={styles.dayNumber}
              data-today={day.date === today || undefined}
              aria-current={day.date === today ? "date" : undefined}
              aria-label={`Open ${shortDay(day.date)} in day view`}
              title="Open this day"
              onClick={() => onShowDay(day.date)}
            >
              {dayNumberOf(day.date)}
            </button>
            {day.date >= today ? (
              <button
                type="button"
                className={styles.cellAdd}
                aria-label={`New post on ${shortDay(day.date)}`}
                onClick={(event) => onCreate(day.date, event.currentTarget)}
              >
                <Plus size={14} aria-hidden />
              </button>
            ) : null}
          </span>
        ))}
      </div>
      <div ref={scrollRef} className={styles.weekScroll}>
        <div className={styles.weekBody} style={{ height: WEEK_HOURS * WEEK_HOUR_HEIGHT }} role="list">
          <div className={styles.gutter} aria-hidden>
            {Array.from({ length: WEEK_HOURS }, (_, hour) => (
              <span
                key={hour}
                className={styles.hourLabel}
                style={{ top: Math.max(hour * WEEK_HOUR_HEIGHT - 6, 2) }}
              >
                {String(hour).padStart(2, "0")}:00
              </span>
            ))}
          </div>
          {days.map((day) => {
            const list = byDate.get(day.date) ?? [];
            const tops = weekTops(list.map((entry) => entry.time));
            const open = day.date >= today;
            return (
              <div
                key={day.date}
                role="listitem"
                aria-label={shortDay(day.date)}
                className={styles.weekColumn}
                data-weekend={day.weekend || undefined}
                data-drop={dragOver === day.date || undefined}
                data-open={open || undefined}
                title="Open this day"
                onClick={(event) => {
                  if (isEmptySlotClick(event)) onShowDay(day.date);
                }}
                {...dropProps(day.date, open, (event, grabY) =>
                  timeAtOffset(event.clientY - grabY - event.currentTarget.getBoundingClientRect().top),
                )}
              >
                {now && now.date === day.date ? (
                  <span
                    className={styles.nowLine}
                    style={{ top: (now.minutes / 60) * WEEK_HOUR_HEIGHT }}
                    aria-hidden
                  />
                ) : null}
                {list.map((entry, index) => cardFor(entry, "week", tops[index]))}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
