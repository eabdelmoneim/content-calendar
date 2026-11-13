"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import { Checkbox } from "../ui/checkbox";
import { cx } from "../ui/cx";
import styles from "./data-table.module.css";

export type SortDir = "asc" | "desc";

export type DataTableColumn<Row> = {
  /** Stable column id. Used for sorting, visibility and React keys. */
  key: string;
  header: ReactNode;
  /**
   * Plain-text column name for the Columns menu and the sort button's
   * spoken name. Defaults to `header` when that is a string.
   */
  label?: string;
  /**
   * A fixed grid track: `minmax(0, 1fr)` for text columns, a fixed width
   * such as `96px` for numbers.
   */
  width: string;
  /** Right-aligned, tabular figures. */
  numeric?: boolean;
  render: (row: Row) => ReactNode;
  /** Header becomes a sort button (needs `onSortChange` on the table). */
  sortable?: boolean;
  /** Direction applied on the first click. Numbers default to `desc`. */
  defaultSortDir?: SortDir;
  /** Always shown; the Columns menu lists it disabled. */
  locked?: boolean;
  /** Hidden until the person turns it on (when `hiddenColumns` is not set). */
  defaultHidden?: boolean;
};

/** What a Columns menu needs to know about each column. */
export type DataTableColumnOption = {
  id: string;
  label: string;
  locked: boolean;
  defaultHidden: boolean;
};

export type DataTableSelection = {
  selected: ReadonlySet<string>;
  onChange: (next: Set<string>) => void;
  /** Row name for its checkbox label: "Select {name}". */
  getRowLabel: (rowId: string) => string;
  /**
   * Fires when the header checkbox selects or clears every row on this
   * page, after `onChange`. Use it to offer "Select all N matching".
   */
  onSelectPage?: (selected: boolean, pageIds: string[]) => void;
  /** Header checkbox label. Defaults to "Select all rows". */
  selectAllLabel?: string;
  /** Disables every checkbox, e.g. while the rows are being re-read. */
  disabled?: boolean;
};

export type DataTableProps<Row> = {
  /** Accessible name, usually the card title. */
  label: string;
  columns: DataTableColumn<Row>[];
  rows: Row[];
  getRowId: (row: Row) => string;
  /** Makes rows clickable (hover fill, Enter/Space to activate). */
  onRowActivate?: (row: Row) => void;
  /** Adds a 40px checkbox column with a select-all header checkbox. */
  selection?: DataTableSelection;
  /** 54px for rows with a subline (default), 50px for single-line rows. */
  density?: "comfortable" | "compact";
  /** Shown in place of rows when `rows` is empty. */
  empty?: ReactNode;
  className?: string;
  /** Current sort column `key`. */
  sortKey?: string;
  sortDir?: SortDir;
  /** Clicking a sortable header: same column flips, another starts fresh. */
  onSortChange?: (key: string, dir: SortDir) => void;
  /**
   * Controlled set of hidden column keys. Locked columns ignore it. When
   * omitted, columns with `defaultHidden` are hidden.
   */
  hiddenColumns?: ReadonlySet<string>;
  /**
   * Header sticks to the top of the nearest scroll container (or of the
   * table itself with `maxHeight`). Offset with `--dt-sticky-top`.
   */
  stickyHeader?: boolean;
  /** Checkbox and first visible column stay put while scrolling sideways. */
  stickyFirstColumn?: boolean;
  /** Minimum row width (e.g. `1100px`); narrower containers scroll sideways. */
  minWidth?: string;
  /** Makes the table its own scroll viewport with this max height. */
  maxHeight?: string;
  /**
   * Rendered above the table, e.g. a SelectionBanner ("All 25 on this page
   * are selected. Select all 312 matching").
   */
  banner?: ReactNode;
  /** Highlights the row whose drawer is open (not the same as selected). */
  activeRowId?: string | null;
};

/** Plain-text name of a column. */
export function columnLabel<Row>(column: DataTableColumn<Row>): string {
  if (column.label) return column.label;
  return typeof column.header === "string" ? column.header : column.key;
}

/** Column metadata for a Columns menu. */
export function columnOptions<Row>(
  columns: DataTableColumn<Row>[],
): DataTableColumnOption[] {
  return columns.map((column) => ({
    id: column.key,
    label: columnLabel(column),
    locked: column.locked ?? false,
    defaultHidden: column.defaultHidden ?? false,
  }));
}

/** The initial `hiddenColumns` set: every `defaultHidden`, unlocked column. */
export function defaultHiddenColumns(
  columns: ReadonlyArray<{
    key?: string;
    id?: string;
    locked?: boolean;
    defaultHidden?: boolean;
  }>,
): Set<string> {
  return new Set(
    columns
      .filter((column) => column.defaultHidden && !column.locked)
      .map((column) => (column.key ?? column.id) as string),
  );
}

/** Columns that render, in order, given a hidden set. */
export function visibleColumns<Row>(
  columns: DataTableColumn<Row>[],
  hidden: ReadonlySet<string> | undefined,
): DataTableColumn<Row>[] {
  const hide = hidden ?? defaultHiddenColumns(columns);
  return columns.filter((column) => column.locked || !hide.has(column.key));
}

/** Next sort state after clicking a header. */
export function nextSort(
  column: { key: string; numeric?: boolean; defaultSortDir?: SortDir },
  sortKey: string | undefined,
  sortDir: SortDir | undefined,
): { key: string; dir: SortDir } {
  if (sortKey === column.key) {
    return { key: column.key, dir: sortDir === "asc" ? "desc" : "asc" };
  }
  return {
    key: column.key,
    dir: column.defaultSortDir ?? (column.numeric ? "desc" : "asc"),
  };
}

/**
 * In-card table (DESIGN.md › Tables inside cards): a 34px inset header on the
 * canvas fill, 50–54px rows with hairline dividers, right-aligned tabular
 * numbers. Uses ARIA table roles on a CSS grid so columns stay fixed tracks.
 */
export function DataTable<Row>({
  label,
  columns,
  rows,
  getRowId,
  onRowActivate,
  selection,
  density = "comfortable",
  empty,
  className,
  sortKey,
  sortDir,
  onSortChange,
  hiddenColumns,
  stickyHeader = false,
  stickyFirstColumn = false,
  minWidth,
  maxHeight,
  banner,
  activeRowId,
}: DataTableProps<Row>): React.JSX.Element {
  const shown = visibleColumns(columns, hiddenColumns);
  const tracks = [
    ...(selection ? ["40px"] : []),
    ...shown.map((column) => column.width),
  ].join(" ");
  const gridStyle = {
    "--dt-columns": tracks,
    ...(minWidth ? { "--dt-min-width": minWidth } : null),
    ...(maxHeight ? { maxHeight } : null),
  } as CSSProperties;

  const ids = rows.map(getRowId);
  const selectedCount = selection
    ? ids.filter((id) => selection.selected.has(id)).length
    : 0;
  const allSelected = ids.length > 0 && selectedCount === ids.length;
  const someSelected = selectedCount > 0 && !allSelected;

  function toggleAll(): void {
    if (!selection) return;
    const next = new Set(selection.selected);
    if (allSelected) ids.forEach((id) => next.delete(id));
    else ids.forEach((id) => next.add(id));
    selection.onChange(next);
    selection.onSelectPage?.(!allSelected, ids);
  }

  function toggleRow(id: string, checked: boolean): void {
    if (!selection) return;
    const next = new Set(selection.selected);
    if (checked) next.add(id);
    else next.delete(id);
    selection.onChange(next);
  }

  function onRowKeyDown(event: KeyboardEvent<HTMLDivElement>, row: Row): void {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onRowActivate?.(row);
    }
  }

  // Sticky first column: the checkbox cell and the first data column.
  const stickyCheck = stickyFirstColumn && Boolean(selection);
  const stickyIndex = stickyFirstColumn ? 0 : -1;
  const firstStickyClass = (index: number): string | false =>
    index === stickyIndex &&
    cx(styles.sticky, selection ? styles.stickyAfterCheck : styles.stickyFirst);

  const table = (
    <div
      role="table"
      aria-label={label}
      aria-rowcount={rows.length + 1}
      className={cx(
        styles.table,
        maxHeight && styles.scroll,
        minWidth && styles.wide,
        stickyHeader && styles.stickyHeader,
        className,
      )}
      style={gridStyle}
      tabIndex={maxHeight ? 0 : undefined}
    >
      <div role="rowgroup" className={styles.headGroup}>
        <div role="row" className={cx(styles.grid, styles.header)}>
          {selection ? (
            <span
              role="columnheader"
              className={cx(
                styles.checkCell,
                stickyCheck && cx(styles.sticky, styles.stickyFirst),
              )}
            >
              <Checkbox
                aria-label={selection.selectAllLabel ?? "Select all rows"}
                checked={allSelected}
                indeterminate={someSelected}
                disabled={ids.length === 0 || selection.disabled}
                onCheckedChange={toggleAll}
              />
            </span>
          ) : null}
          {shown.map((column, index) => {
            const sortable = Boolean(column.sortable && onSortChange);
            const active = sortable && sortKey === column.key;
            const ariaSort = sortable
              ? active
                ? sortDir === "desc"
                  ? "descending"
                  : "ascending"
                : "none"
              : undefined;
            return (
              <span
                key={column.key}
                role="columnheader"
                aria-sort={ariaSort}
                className={cx(
                  styles.headCell,
                  column.numeric && styles.numeric,
                  firstStickyClass(index),
                )}
              >
                {sortable ? (
                  <SortButton
                    active={active}
                    dir={sortDir}
                    numeric={column.numeric}
                    onClick={() => {
                      const next = nextSort(column, sortKey, sortDir);
                      onSortChange?.(next.key, next.dir);
                    }}
                  >
                    {column.header}
                  </SortButton>
                ) : (
                  column.header
                )}
              </span>
            );
          })}
        </div>
      </div>
      <div role="rowgroup" className={styles.bodyGroup}>
        {rows.length === 0 ? (
          <div role="row" className={styles.emptyRow}>
            <span
              role="cell"
              aria-colspan={shown.length + (selection ? 1 : 0)}
              className={styles.emptyCell}
            >
              {empty ?? "No rows"}
            </span>
          </div>
        ) : (
          rows.map((row) => {
            const id = getRowId(row);
            const isSelected = selection?.selected.has(id) ?? false;
            const clickable = Boolean(onRowActivate);
            return (
              <div
                key={id}
                role="row"
                tabIndex={clickable ? 0 : undefined}
                aria-current={activeRowId === id ? true : undefined}
                className={cx(
                  styles.grid,
                  styles.row,
                  density === "compact" && styles.compact,
                  clickable && styles.clickable,
                  isSelected && styles.selected,
                  activeRowId === id && styles.active,
                )}
                onClick={clickable ? () => onRowActivate?.(row) : undefined}
                onKeyDown={
                  clickable ? (event) => onRowKeyDown(event, row) : undefined
                }
              >
                {selection ? (
                  <span
                    role="cell"
                    className={cx(
                      styles.checkCell,
                      stickyCheck && cx(styles.sticky, styles.stickyFirst),
                    )}
                    // Checking a row must not also open it.
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    <Checkbox
                      aria-label={`Select ${selection.getRowLabel(id)}`}
                      checked={isSelected}
                      disabled={selection.disabled}
                      onCheckedChange={(checked) => toggleRow(id, checked)}
                    />
                  </span>
                ) : null}
                {shown.map((column, index) => (
                  <span
                    key={column.key}
                    role="cell"
                    className={cx(
                      styles.cell,
                      column.numeric && styles.numeric,
                      firstStickyClass(index),
                    )}
                  >
                    {column.render(row)}
                  </span>
                ))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  if (banner === undefined || banner === null || banner === false) return table;
  return (
    <>
      {banner}
      {table}
    </>
  );
}

function SortButton({
  active,
  dir,
  numeric,
  onClick,
  children,
}: {
  active: boolean;
  dir: SortDir | undefined;
  numeric?: boolean;
  onClick: () => void;
  children: ReactNode;
}): React.JSX.Element {
  const Icon = !active ? ChevronsUpDown : dir === "desc" ? ArrowDown : ArrowUp;
  return (
    <button
      type="button"
      className={cx(
        styles.sortButton,
        active && styles.sortActive,
        numeric && styles.sortNumeric,
      )}
      onClick={onClick}
    >
      {children}
      <Icon className={styles.sortIcon} size={12} strokeWidth={2} aria-hidden />
    </button>
  );
}

export type SelectionBannerProps = {
  /** e.g. "All 25 people on this page are selected." */
  children: ReactNode;
  /** Inline link-style action, e.g. "Select all 312 matching these filters". */
  actionLabel?: ReactNode;
  onAction?: () => void;
  className?: string;
};

/**
 * Full-width notice above a DataTable that offers to extend a page selection
 * to every matching row, or to clear it. Announced politely.
 */
export function SelectionBanner({
  children,
  actionLabel,
  onAction,
  className,
}: SelectionBannerProps): React.JSX.Element {
  return (
    <div role="status" className={cx(styles.banner, className)}>
      <span>{children}</span>
      {actionLabel && onAction ? (
        <button
          type="button"
          className={styles.bannerAction}
          onClick={onAction}
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

/** Leading entity cell: tile or avatar, 13/18 500 title, 12/16 subline. */
export function EntityCell({
  media,
  title,
  subline,
}: {
  media?: ReactNode;
  title: ReactNode;
  subline?: ReactNode;
}): React.JSX.Element {
  return (
    <span className={styles.entity}>
      {media}
      <span className={styles.entityText}>
        <span className={styles.entityTitle}>{title}</span>
        {subline ? <span className={styles.entitySub}>{subline}</span> : null}
      </span>
    </span>
  );
}
