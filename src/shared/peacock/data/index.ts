/**
 * Peacock data components (Phase 1a). Hand-built SVG/CSS charts; no chart
 * library. Number formatting lives in `../format`.
 */
export {
  BarChart,
  barHeights,
  bucketWeekly,
  peakIndex,
  showsAxisLabel,
} from "./bar-chart";
export type {
  Bar,
  BarChartProps,
  BarPoint,
  WeeklyAggregate,
} from "./bar-chart";
export { Card, CardHeader, IconTile } from "./card";
export type { CardHeaderProps, CardProps } from "./card";
export { ColumnsMenu } from "./columns-menu";
export type { ColumnsMenuProps } from "./columns-menu";
export {
  columnLabel,
  columnOptions,
  DataTable,
  defaultHiddenColumns,
  EntityCell,
  nextSort,
  SelectionBanner,
  visibleColumns,
} from "./data-table";
export type {
  DataTableColumn,
  DataTableColumnOption,
  DataTableProps,
  DataTableSelection,
  SelectionBannerProps,
  SortDir,
} from "./data-table";
export {
  PAGE_SIZE_OPTIONS,
  pageCount,
  pageList,
  Pagination,
  rangeLabel,
} from "./pagination";
export type { PageItem, PaginationProps } from "./pagination";
export { DeltaPill } from "./delta-pill";
export type { DeltaPillProps, DeltaTone } from "./delta-pill";
export { arcPath, donutArcs, HalfDonut } from "./half-donut";
export type { HalfDonutProps, HalfDonutSegment } from "./half-donut";
export { KpiCard } from "./kpi-card";
export type { KpiCardProps } from "./kpi-card";
export { ProgressBar } from "./progress-bar";
export type { ProgressBarProps } from "./progress-bar";
export { SERIES_ORDER, seriesAt } from "./series";
export type { SeriesColor } from "./series";
export { GrowthText, StackedBar, StackedBarLegend } from "./stacked-bar";
export type {
  StackedBarLegendRow,
  StackedBarProps,
  StackedBarSegment,
} from "./stacked-bar";
