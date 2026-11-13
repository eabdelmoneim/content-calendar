"use client";

import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useId } from "react";
import { formatCount } from "../format";
import { cx } from "../ui/cx";
import styles from "./pagination.module.css";

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export type PaginationProps = {
  /** 1-based current page. Values out of range are clamped for display. */
  page: number;
  pageSize: number;
  /** Total matching rows across all pages. */
  total: number;
  onPageChange: (page: number) => void;
  /** Omit to hide the rows-per-page select. Callers usually reset to page 1. */
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: readonly number[];
  /** Range text when `total` is 0, e.g. "0 people". */
  emptyLabel?: string;
  /** Accessible name of the page navigation. */
  label?: string;
  className?: string;
};

export type PageItem = number | "gap";

/** Number of pages for a total; never less than 1. */
export function pageCount(total: number, pageSize: number): number {
  if (pageSize <= 0) return 1;
  return Math.max(1, Math.ceil(Math.max(total, 0) / pageSize));
}

/**
 * Page buttons to show: first, current−1, current, current+1 and last, with
 * a gap wherever numbers are skipped. A gap that would hide a single page
 * shows that page instead. pageList(5, 20) → [1, "gap", 4, 5, 6, "gap", 20].
 */
export function pageList(page: number, pages: number): PageItem[] {
  if (pages <= 1) return [1];
  const current = Math.min(Math.max(page, 1), pages);
  const wanted = new Set([1, current - 1, current, current + 1, pages]);
  const sorted = [...wanted]
    .filter((n) => n >= 1 && n <= pages)
    .sort((a, b) => a - b);
  const out: PageItem[] = [];
  sorted.forEach((n, i) => {
    const prev = sorted[i - 1];
    if (prev !== undefined && n - prev === 2) out.push(prev + 1);
    else if (prev !== undefined && n - prev > 2) out.push("gap");
    out.push(n);
  });
  return out;
}

/** "1–10 of 312". */
export function rangeLabel(
  page: number,
  pageSize: number,
  total: number,
  emptyLabel = "0 results",
): string {
  if (total <= 0) return emptyLabel;
  const pages = pageCount(total, pageSize);
  const current = Math.min(Math.max(page, 1), pages);
  const start = (current - 1) * pageSize + 1;
  const end = Math.min(current * pageSize, total);
  return `${formatCount(start)}–${formatCount(end)} of ${formatCount(total)}`;
}

/**
 * Table footer pagination (Leads › table footer): rows-per-page select, range
 * label, then previous / numbered pages / next. Fully controlled.
 */
export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
  emptyLabel,
  label = "Pagination",
  className,
}: PaginationProps): React.JSX.Element {
  const selectId = useId();
  const pages = pageCount(total, pageSize);
  const current = Math.min(Math.max(page, 1), pages);
  const atFirst = current <= 1;
  const atLast = current >= pages;
  const options = pageSizeOptions.includes(pageSize)
    ? pageSizeOptions
    : [...pageSizeOptions, pageSize].sort((a, b) => a - b);

  return (
    <div className={cx(styles.root, className)}>
      {onPageSizeChange ? (
        <span className={styles.size}>
          <label htmlFor={selectId}>Rows per page</label>
          <span className={styles.selectWrap}>
            <select
              id={selectId}
              className={styles.select}
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
            >
              {options.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <ChevronDown
              className={styles.chevron}
              size={12}
              strokeWidth={2}
              aria-hidden
            />
          </span>
        </span>
      ) : null}
      <span className={styles.range} aria-live="polite">
        {rangeLabel(current, pageSize, total, emptyLabel)}
      </span>
      <span className={styles.spacer} />
      <nav aria-label={label} className={styles.nav}>
        <button
          type="button"
          className={cx(styles.button, styles.arrow)}
          aria-label="Previous page"
          disabled={atFirst}
          onClick={() => onPageChange(current - 1)}
        >
          <ChevronLeft size={14} strokeWidth={2} aria-hidden />
        </button>
        {pageList(current, pages).map((item, index) =>
          item === "gap" ? (
            <span key={`gap-${index}`} className={styles.gap} aria-hidden>
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              className={cx(styles.button, item === current && styles.current)}
              aria-label={`Page ${item}`}
              aria-current={item === current ? "page" : undefined}
              onClick={() => {
                if (item !== current) onPageChange(item);
              }}
            >
              {formatCount(item)}
            </button>
          ),
        )}
        <button
          type="button"
          className={cx(styles.button, styles.arrow)}
          aria-label="Next page"
          disabled={atLast}
          onClick={() => onPageChange(current + 1)}
        >
          <ChevronRight size={14} strokeWidth={2} aria-hidden />
        </button>
      </nav>
    </div>
  );
}
