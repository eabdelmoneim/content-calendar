"use client";

import Link from "next/link";
import { useCallback, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  Activity,
  ChartNoAxesColumn,
  CircleX,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Heart,
  Info,
  Plus,
  Trophy,
  Unplug,
  Users,
} from "lucide-react";
import { useFollowerSnapshots, usePosts, useProfiles } from "@/lib/api";
import type { Post } from "@/lib/types";
import { useProfileSelection } from "@/shared/shell/profile-selection";
import { ROUTES } from "@/shared/peacock/shell/nav";
import {
  BarChart,
  Card,
  CardHeader,
  DataTable,
  DeltaPill,
  EntityCell,
  GrowthText,
  HalfDonut,
  IconTile,
  KpiCard,
  ProgressBar,
  StackedBar,
  StackedBarLegend,
  seriesAt,
  type BarPoint,
  type DataTableColumn,
  type SeriesColor,
} from "@/shared/peacock/data";
import { Button, EmptyState, Segmented, Skeleton } from "@/shared/peacock/ui";
import { formatCount, formatPercent, formatShortDate, formatSignedCount, MISSING } from "@/shared/peacock/format";
import {
  accountFollowers,
  accountLabel,
  buildAccounts,
  followerGrowthSeries,
  formatBreakdown,
  metricDelta,
  METRIC_ORDER,
  METRICS,
  observedTotals,
  platformName,
  postRows,
  postSeries,
  postsInRange,
  presetDates,
  previousPeriod,
  rangeDays,
  relativeTime,
  sortPostRows,
  SOURCE_LABEL,
  utcDay,
  type Account,
  type MetricId,
  type PlatformFilter,
  type PostRow,
  type PostSort,
} from "./analytics-model";
import { PlatformMark } from "./brand-icons";
import { DateRangeControl, PlatformMenu, PlatformSegmented, type RangeChoice } from "./analytics-toolbar";
import { AccountsCard, FormatCard, type AccountSummary } from "./engagement-cards";
import { FollowerCountDialog, UpdateNumbersDialog } from "./metrics-dialogs";
import styles from "./analytics.module.css";

const METRIC_ICONS: Record<MetricId, ReactNode> = {
  posts: <FileText size={15} />,
  impressions: <Eye size={15} />,
  engagements: <Heart size={15} />,
  engagement: <Activity size={15} />,
  followers: <Users size={15} />,
};

const MOBILE_QUERY = "(max-width: 767px)";
const TOP_LIMIT = 5;

function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (notify: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", notify);
      return () => list.removeEventListener("change", notify);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

const subscribeMinute = (notify: () => void) => {
  const id = window.setInterval(notify, 60_000);
  return () => window.clearInterval(id);
};
const todaySnapshot = () => utcDay(Date.now());
const serverToday = () => "";
// Stable within a minute, so the snapshot only changes when the tick fires.
const minuteSnapshot = () => Math.floor(Date.now() / 60_000) * 60_000;
const serverMinute = () => 0;

function csvCell(value: string | number | null): string {
  if (value === null) return "";
  let text = String(value);
  // Spreadsheet formula injection: neutralise leading = + - @ and controls.
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCsv(filename: string, rows: PostRow[]): void {
  const header = [
    "published_date",
    "platform",
    "account",
    "text",
    "impressions",
    "reactions",
    "comments",
    "reposts",
    "clicks",
    "engagement_rate_percent",
    "numbers_updated_at",
    "source",
    "url",
  ];
  const lines = rows.map((row) => {
    const m = row.post.metrics;
    return [
      row.post.publishedAt ? utcDay(row.post.publishedAt) : null,
      platformName(row.platform),
      row.author,
      row.post.contentText,
      m?.impressions ?? null,
      m?.reactions ?? null,
      m?.comments ?? null,
      m?.reposts ?? null,
      m?.clicks ?? null,
      row.engagement === null ? null : Number(row.engagement.toFixed(2)),
      m?.capturedAt ?? null,
      m ? SOURCE_LABEL[m.source] : null,
      row.url,
    ]
      .map(csvCell)
      .join(",");
  });
  const csv = [header.join(","), ...lines].join("\r\n");
  const url = URL.createObjectURL(
    // Leading byte-order mark so spreadsheet apps read the file as UTF-8.
    new Blob([String.fromCharCode(0xfeff), csv], { type: "text/csv;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function AnalyticsPage(): React.JSX.Element {
  const selection = useProfileSelection();
  const postsQuery = usePosts();
  const snapshotsQuery = useFollowerSnapshots();
  const profilesQuery = useProfiles();
  const today = useSyncExternalStore(subscribeMinute, todaySnapshot, serverToday);
  const now = useSyncExternalStore(subscribeMinute, minuteSnapshot, serverMinute);
  const mobile = useMediaQuery(MOBILE_QUERY);

  const [choice, setChoice] = useState<RangeChoice>({ preset: 28 });
  const [platform, setPlatform] = useState<PlatformFilter>("all");
  const [metric, setMetric] = useState<MetricId>("impressions");
  const [intervalChoice, setIntervalChoice] = useState<"day" | "week">("day");
  const [presetOpen, setPresetOpen] = useState(false);
  const [editing, setEditing] = useState<Post | null>(null);
  // undefined: closed; null: open with the first account; string: that account.
  const [followerFor, setFollowerFor] = useState<string | null | undefined>(undefined);
  // Mobile shows the weekly chart only, like Peacock.
  const interval = mobile ? "week" : intervalChoice;

  const dates = "preset" in choice ? (today ? presetDates(choice.preset, today) : null) : choice;
  const start = dates?.start ?? "";
  const end = dates?.end ?? "";
  const days = useMemo(() => (start && end ? rangeDays(start, end) : []), [start, end]);

  const posts = postsQuery.data;
  const snapshots = snapshotsQuery.data;
  const profiles = profilesQuery.data;
  const selectedIds = selection.selectedProfileIds;

  const accounts = useMemo(
    () => buildAccounts(profiles ?? [], new Set(selectedIds), platform, posts ?? [], snapshots ?? []),
    [profiles, selectedIds, platform, posts, snapshots],
  );
  // For the follower dialog: every platform account of the selected people.
  const allPlatformAccounts = useMemo(
    () => buildAccounts(profiles ?? [], new Set(selectedIds), "all", posts ?? [], snapshots ?? []),
    [profiles, selectedIds, posts, snapshots],
  );
  const current = useMemo(
    () => (start ? postsInRange(posts ?? [], accounts, start, end) : []),
    [posts, accounts, start, end],
  );
  const previous = useMemo(() => {
    if (!start) return [];
    const prior = previousPeriod(start, end);
    return postsInRange(posts ?? [], accounts, prior.start, prior.end);
  }, [posts, accounts, start, end]);

  const totals = useMemo(() => observedTotals(current), [current]);
  const priorTotals = useMemo(() => observedTotals(previous), [previous]);
  const followerByAccount = useMemo(
    () =>
      new Map(
        accounts.map((account) => [account.id, accountFollowers(snapshots ?? [], account, start, end)]),
      ),
    [accounts, snapshots, start, end],
  );
  const followerTotal = useMemo(() => {
    let value: number | null = null;
    let change: number | null = null;
    for (const f of followerByAccount.values()) {
      if (f.current !== null) value = (value ?? 0) + f.current;
      if (f.change !== null) change = (change ?? 0) + f.change;
    }
    return { value, change };
  }, [followerByAccount]);

  const rows = useMemo(() => postRows(current, profiles ?? []), [current, profiles]);
  const accountSummaries = useMemo<AccountSummary[]>(
    () =>
      accounts.map((account) => ({
        account,
        totals: observedTotals(current.filter((p) => p.profileId === account.profile.id && p.platform === account.platform)),
        followers: followerByAccount.get(account.id) ?? { current: null, currentOn: null, change: null },
      })),
    [accounts, current, followerByAccount],
  );

  const queryError = postsQuery.error ?? snapshotsQuery.error ?? profilesQuery.error;
  const loading = !queryError && (selection.loading || !dates || !posts || !snapshots || !profiles);
  const noProfiles = !selection.loading && profiles !== undefined && selectedIds.length === 0;
  const noAccounts = !noProfiles && profiles !== undefined && allPlatformAccounts.length === 0;

  const toolbar = mobile ? (
    <div className={styles.mobileChips}>
      <DateRangeControl
        variant="chip"
        today={today}
        choice={choice}
        dates={dates}
        onChange={setChoice}
        presetOpen={presetOpen}
        onPresetOpenChange={setPresetOpen}
      />
      <PlatformMenu value={platform} onChange={setPlatform} />
    </div>
  ) : (
    <div className={styles.toolbar}>
      <span className={styles.spacer} />
      <PlatformSegmented value={platform} onChange={setPlatform} />
      <DateRangeControl
        today={today}
        choice={choice}
        dates={dates}
        onChange={setChoice}
        presetOpen={presetOpen}
        onPresetOpenChange={setPresetOpen}
      />
      <Button
        icon={<Download size={14} />}
        disabled={rows.length === 0}
        onClick={() => downloadCsv(`analytics-${start}-to-${end}.csv`, rows)}
      >
        Export
      </Button>
    </div>
  );

  let body: ReactNode;
  // `dates` is null until the client clock is read (server render and
  // hydration), so both render the same loading state.
  if (!dates) {
    body = <LoadingState />;
  } else if (queryError) {
    body = (
      <Card className={styles.emptyCard}>
        <EmptyState
          headingLevel={2}
          icon={<CircleX size={20} />}
          title="Analytics couldn't load"
          body={queryError.message}
          action={
            <Button
              variant="secondary"
              onClick={() => {
                void postsQuery.refetch();
                void snapshotsQuery.refetch();
                void profilesQuery.refetch();
              }}
            >
              Try again
            </Button>
          }
        />
      </Card>
    );
  } else if (noProfiles || noAccounts) {
    body = (
      <Card className={styles.emptyCard}>
        <EmptyState
          headingLevel={2}
          icon={<Unplug size={20} />}
          title={noProfiles ? "No accounts selected" : "No accounts set up"}
          body={
            noProfiles
              ? "Pick one or more accounts in the selector at the top to see their numbers."
              : "Add a LinkedIn or X account to a profile in Settings. Analytics start from the first post you mark as posted."
          }
          action={
            noProfiles ? undefined : (
              <Link href={ROUTES.settings} className={styles.primaryLink}>
                Go to Settings
              </Link>
            )
          }
        />
      </Card>
    );
  } else if (loading) {
    body = <LoadingState />;
  } else {
    const spec = METRICS[metric];
    const followers = metric === "followers";
    const kpis: Record<MetricId, { value: number | null; delta: number | null }> = {
      posts: { value: totals.posts, delta: metricDelta(totals.posts, priorTotals.posts, "absolute") },
      impressions: {
        value: totals.impressions,
        delta: metricDelta(totals.impressions, priorTotals.impressions, "percent"),
      },
      engagements: {
        value: totals.engagements,
        delta: metricDelta(totals.engagements, priorTotals.engagements, "percent"),
      },
      engagement: {
        value: totals.engagement,
        delta: metricDelta(totals.engagement, priorTotals.engagement, "pts"),
      },
      followers: { value: followerTotal.value, delta: followerTotal.change },
    };
    const kpi = kpis[metric];
    const series: BarPoint[] = followers
      ? followerGrowthSeries(days, accounts, snapshots ?? [])
      : postSeries(metric, days, current);
    const gained = followers && series.length ? series.reduce((sum, point) => sum + point.value, 0) : null;
    const chartTitle = `${followers ? "Follower growth" : spec.label} per ${interval === "week" ? "week" : "day"}`;
    const chartFormat = followers ? formatSignedCount : spec.format;
    const comparison = `vs previous ${days.length} days`;
    const noPostsInRange = current.length === 0 && !followers;

    body = (
      <>
        <div className={styles.kpis}>
          {METRIC_ORDER.map((id) => {
            const value = kpis[id];
            return (
              <KpiCard
                key={id}
                icon={METRIC_ICONS[id]}
                label={METRICS[id].label}
                definition={METRICS[id].definition}
                value={value.value === null ? MISSING : METRICS[id].format(value.value)}
                delta={value.delta === null ? undefined : { value: value.delta, format: METRICS[id].deltaFormat }}
                selected={metric === id}
                onSelect={() => setMetric(id)}
              />
            );
          })}
        </div>
        <div className={styles.chartRow}>
          <Card aria-labelledby="analytics-chart-title">
            <CardHeader
              id="analytics-chart-title"
              icon={<ChartNoAxesColumn size={15} />}
              title={chartTitle}
              actions={
                mobile ? undefined : (
                  <Segmented
                    label="Interval"
                    size="compact"
                    value={intervalChoice}
                    onChange={setIntervalChoice}
                    options={[
                      { value: "day", label: "Daily" },
                      { value: "week", label: "Weekly" },
                    ]}
                  />
                )
              }
            />
            {mobile ? null : (
              <>
                <p className={styles.headline}>
                  {followers ? formatSignedCount(gained) : kpi.value === null ? MISSING : spec.format(kpi.value)}
                </p>
                {followers ? (
                  gained !== null ? (
                    <p className={styles.comparison}>followers gained over {days.length} days</p>
                  ) : null
                ) : kpi.delta !== null ? (
                  <p className={styles.comparison}>
                    <DeltaPill value={kpi.delta} format={spec.deltaFormat} />
                    {comparison}
                  </p>
                ) : (
                  <p className={styles.comparison}>By publish day · no comparison for the previous {days.length} days</p>
                )}
              </>
            )}
            <div className={styles.plot}>
              {noPostsInRange ? (
                <div className={styles.plotEmpty}>
                  <span>
                    Nothing was published between {formatShortDate(start)} and {formatShortDate(end)} from the
                    selected accounts.
                    <br />
                    <button type="button" className={styles.inlineLink} onClick={() => setPresetOpen(true)}>
                      Change date range
                    </button>
                  </span>
                </div>
              ) : series.length === 0 ? (
                <p className={styles.plotEmpty}>
                  No follower counts were entered for these accounts in this range. Use “Add follower count” below.
                </p>
              ) : (
                <BarChart
                  label={chartTitle}
                  series={series}
                  interval={interval}
                  format={chartFormat}
                  weeklyAggregate={spec.weekly}
                />
              )}
            </div>
          </Card>
          {mobile ? null : <EngagementCard totals={totals} />}
        </div>
        <TopPostsCard rows={rows} mobile={mobile} now={now} onEdit={(post) => setEditing(post)} />
        <div className={styles.thirdRow}>
          <AccountsCard rows={accountSummaries} onAddFollowers={(id) => setFollowerFor(id)} />
          <div className={styles.sideStack}>
            {mobile ? null : (
              <FollowersCard
                accounts={accounts}
                followers={followerByAccount}
                onAdd={() => setFollowerFor(null)}
              />
            )}
            <FormatCard rows={formatBreakdown(current)} />
          </div>
        </div>
      </>
    );
  }

  const newest = (posts ?? [])
    .map((post) => post.metrics?.capturedAt ?? null)
    .filter((at): at is string => at !== null)
    .sort()
    .at(-1);

  return (
    <div className={styles.page}>
      {toolbar}
      {body}
      <p className={styles.footnote}>
        <Info size={13} aria-hidden className={styles.footnoteIcon} />
        <span>
          {[
            "Numbers are entered by hand for now: copy each post's totals from its analytics on LinkedIn or X with “Update numbers”, and each account's follower count with “Add follower count”. Days are in UTC.",
            !loading && newest ? `Last update ${relativeTime(newest, now)}.` : null,
            !loading && totals.pending > 0
              ? `${totals.pending} ${totals.pending === 1 ? "post in this range has" : "posts in this range have"} no numbers yet.`
              : null,
          ]
            .filter(Boolean)
            .join(" ")}
        </span>
      </p>
      {editing ? (
        <UpdateNumbersDialog
          post={editing}
          authorName={profiles?.find((p) => p.id === editing.profileId)?.name ?? "Unknown account"}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {followerFor !== undefined ? (
        <FollowerCountDialog
          accounts={allPlatformAccounts}
          initialAccountId={followerFor}
          snapshots={snapshots ?? []}
          today={today}
          onClose={() => setFollowerFor(undefined)}
        />
      ) : null}
    </div>
  );
}

function LoadingState(): React.JSX.Element {
  const bars = [40, 55, 35, 70, 50, 62, 30, 45, 80, 52, 38, 60];
  return (
    <div className={styles.loading} role="status" aria-label="Loading analytics">
      <div className={styles.kpis}>
        {METRIC_ORDER.map((id) => (
          <KpiCard key={id} loading icon={METRIC_ICONS[id]} label={METRICS[id].label} value="" />
        ))}
      </div>
      <Card className={styles.skeletonBars} aria-hidden>
        {bars.map((height, index) => (
          <Skeleton key={index} height={`${height}%`} radius="sm" className={styles.skeletonBar} />
        ))}
      </Card>
    </div>
  );
}

function EngagementCard({ totals }: { totals: ReturnType<typeof observedTotals> }): React.JSX.Element {
  const reactions = totals.reactions ?? 0;
  const comments = totals.comments ?? 0;
  const reposts = totals.reposts ?? 0;
  return (
    <Card className={styles.distribution} aria-labelledby="analytics-engagement">
      <CardHeader id="analytics-engagement" icon={<Heart size={15} />} title="Engagement breakdown" />
      <HalfDonut
        className={styles.donut}
        label="Engagement breakdown"
        segments={[
          { label: "Reactions", value: reactions, color: "chart-1" },
          { label: "Comments", value: comments, color: "chart-4" },
          { label: "Reposts", value: reposts, color: "hatch" },
        ]}
        total={totals.engagements === null ? MISSING : formatCount(totals.engagements)}
        caption="interactions"
      />
    </Card>
  );
}

function Provenance({ row, now }: { row: PostRow; now: number }): React.JSX.Element {
  const metrics = row.post.metrics;
  if (!row.hasNumbers || !metrics) return <span className={styles.noNumbers}>No numbers yet</span>;
  return (
    <span title={new Date(metrics.capturedAt).toLocaleString("en-US")}>
      Last updated {relativeTime(metrics.capturedAt, now)} · {SOURCE_LABEL[metrics.source]}
    </span>
  );
}

function PostTitle({ row }: { row: PostRow }): React.JSX.Element {
  if (!row.url) return <>{row.title}</>;
  const where = platformName(row.platform);
  return (
    <a
      className={styles.nativePostLink}
      href={row.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`View on ${where}: ${row.title} · ${row.author} · ${row.date} (opens in a new tab)`}
      title={`View on ${where} (opens in a new tab)`}
    >
      <span className={styles.nativePostTitle}>{row.title}</span>
      <ExternalLink size={13} aria-hidden="true" />
    </a>
  );
}

function UpdateButton({ row, onEdit }: { row: PostRow; onEdit: (post: Post) => void }): React.JSX.Element {
  return (
    <Button
      size="sm"
      variant={row.hasNumbers ? "ghost" : "secondary"}
      icon={row.hasNumbers ? undefined : <Plus size={14} />}
      aria-label={`${row.hasNumbers ? "Update numbers" : "Add numbers"} for ${row.title}`}
      onClick={() => onEdit(row.post)}
    >
      {row.hasNumbers ? "Update" : "Add"}
    </Button>
  );
}

function postColumns(maxRate: number, now: number, onEdit: (post: Post) => void): DataTableColumn<PostRow>[] {
  return [
    {
      key: "post",
      header: "Post",
      width: "minmax(0, 1fr)",
      render: (row) => (
        <EntityCell
          media={
            <IconTile
              size="lg"
              icon={<PlatformMark platform={row.platform} size={14} title={platformName(row.platform)} />}
            />
          }
          title={<PostTitle row={row} />}
          subline={
            <>
              {row.author} · {row.date} · <Provenance row={row} now={now} />
            </>
          }
        />
      ),
    },
    {
      key: "impressions",
      header: "Impressions",
      width: "92px",
      numeric: true,
      render: (row) => formatCount(row.impressions),
    },
    {
      key: "engagements",
      header: "Engagements",
      width: "96px",
      numeric: true,
      render: (row) => formatCount(row.engagements),
    },
    {
      key: "engagement",
      header: "Eng. rate",
      width: "112px",
      render: (row) =>
        row.engagement === null ? (
          MISSING
        ) : (
          <ProgressBar label="Engagement rate" value={row.engagement} max={maxRate}>
            {formatPercent(row.engagement, 1)}
          </ProgressBar>
        ),
    },
    {
      key: "clicks",
      header: "Clicks",
      width: "60px",
      numeric: true,
      render: (row) => formatCount(row.clicks),
    },
    {
      key: "actions",
      header: <span className="sr-only">Numbers</span>,
      label: "Numbers",
      width: "84px",
      render: (row) => <UpdateButton row={row} onEdit={onEdit} />,
    },
  ];
}

function TopPostsCard({
  rows,
  mobile,
  now,
  onEdit,
}: {
  rows: PostRow[];
  mobile: boolean;
  now: number;
  onEdit: (post: Post) => void;
}): React.JSX.Element {
  const [sort, setSort] = useState<PostSort>("impressions");
  const [showAll, setShowAll] = useState(false);
  const sorted = sortPostRows(rows, sort);
  const visible = showAll ? sorted : sorted.slice(0, TOP_LIMIT);
  const maxRate = Math.max(0, ...rows.map((row) => row.engagement ?? 0));
  const sortControl = (
    <Segmented
      label="Sort posts by"
      size="compact"
      value={sort}
      onChange={setSort}
      options={[
        { value: "impressions", label: "Impressions" },
        { value: "engagements", label: "Engagement" },
        { value: "date", label: "Newest" },
      ]}
    />
  );
  const more =
    rows.length > TOP_LIMIT ? (
      <div className={styles.moreRow}>
        <Button size="sm" variant="ghost" onClick={() => setShowAll(!showAll)}>
          {showAll ? "Show top 5" : `Show all ${rows.length} posts`}
        </Button>
      </div>
    ) : null;
  const empty = <p className={styles.audienceEmpty}>Nothing was published in this range.</p>;

  if (mobile)
    return (
      <Card className={styles.mobileTop} aria-labelledby="analytics-top">
        <CardHeader id="analytics-top" icon={<Trophy size={15} />} title="Top posts" />
        <div className={styles.mobileSort}>{sortControl}</div>
        {rows.length === 0 ? (
          empty
        ) : (
          <ul className={styles.mobileTopList}>
            {visible.map((row) => (
              <li key={row.id} className={styles.mobileTopRow}>
                <IconTile
                  size="lg"
                  icon={<PlatformMark platform={row.platform} size={14} title={platformName(row.platform)} />}
                />
                <span className={styles.mobileTopText}>
                  <span className={styles.mobileTopTitle}>
                    <PostTitle row={row} />
                  </span>
                  <span className={styles.mobileTopSub}>
                    {row.author} · {row.date}
                  </span>
                  <span className={styles.mobileTopSub}>
                    {row.hasNumbers
                      ? `${formatCount(row.impressions)} impr. · ${formatCount(row.engagements)} eng. · `
                      : null}
                    <Provenance row={row} now={now} />
                  </span>
                </span>
                <UpdateButton row={row} onEdit={onEdit} />
              </li>
            ))}
          </ul>
        )}
        {more}
      </Card>
    );
  return (
    <Card padding="flush" aria-labelledby="analytics-top">
      <CardHeader
        id="analytics-top"
        icon={<Trophy size={15} />}
        title={showAll ? "Posts in this range" : "Top posts"}
        actions={sortControl}
      />
      <DataTable
        label="Top posts"
        columns={postColumns(maxRate || 1, now, onEdit)}
        rows={visible}
        getRowId={(row) => row.id}
        empty={empty}
      />
      {more}
    </Card>
  );
}

function FollowersCard({
  accounts,
  followers,
  onAdd,
}: {
  accounts: Account[];
  followers: ReadonlyMap<string, { current: number | null; change: number | null }>;
  onAdd: () => void;
}): React.JSX.Element {
  // Largest audiences first; past the fourth, accounts share the muted
  // swatch (Peacock defines four data series).
  const ordered = [...accounts].sort(
    (a, b) => (followers.get(b.id)?.current ?? -1) - (followers.get(a.id)?.current ?? -1),
  );
  const colors = new Map<string, SeriesColor | "muted">();
  let index = 0;
  for (const account of ordered) {
    const live = (followers.get(account.id)?.current ?? 0) > 0;
    colors.set(account.id, live ? seriesAt(index++) : "muted");
  }
  const segments = ordered
    .filter((account) => (followers.get(account.id)?.current ?? 0) > 0)
    .map((account) => ({
      label: accountLabel(account),
      value: followers.get(account.id)?.current ?? 0,
      color: colors.get(account.id),
    }));
  return (
    <Card className={styles.followers} aria-labelledby="analytics-followers">
      <CardHeader
        id="analytics-followers"
        icon={<Users size={15} />}
        title="Followers by account"
        actions={
          <Button size="sm" variant="ghost" icon={<Plus size={14} />} onClick={onAdd}>
            Add count
          </Button>
        }
      />
      {segments.length > 0 ? (
        <StackedBar className={styles.stack} label="Followers by account" segments={segments} />
      ) : (
        <p className={styles.audienceHint}>No follower counts entered yet.</p>
      )}
      <StackedBarLegend
        rows={ordered.map((account) => {
          const f = followers.get(account.id);
          const change = f?.change ?? null;
          return {
            key: account.id,
            color: colors.get(account.id) ?? "muted",
            leading: <PlatformMark platform={account.platform} size={13} title={platformName(account.platform)} />,
            name: account.name,
            value: formatCount(f?.current ?? null),
            trailing:
              change !== null ? (
                <GrowthText tone={change > 0 ? "positive" : change < 0 ? "negative" : "neutral"}>
                  {formatSignedCount(change)}
                </GrowthText>
              ) : undefined,
          };
        })}
      />
    </Card>
  );
}
