/**
 * Pure view-model helpers for Analytics. Everything is computed client-side
 * from the saved posts (latest manual metrics snapshot per post), follower
 * snapshots and profiles. Ported from Peacock's analytics-model; the data
 * source is our own API instead of Convex.
 */
import {
  formatCount,
  formatPercent,
  formatShortDate,
  MISSING,
  type DeltaFormat,
} from "@/shared/peacock/format";
import type { BarPoint, WeeklyAggregate } from "@/shared/peacock/data";
import type {
  FollowerSnapshot,
  Platform,
  Post,
  PostMetrics,
  Profile,
} from "@/lib/types";

export type { Platform };
export type PlatformFilter = "all" | Platform;
export type MetricId =
  | "posts"
  | "impressions"
  | "engagements"
  | "engagement"
  | "followers";

export const METRIC_ORDER: MetricId[] = [
  "posts",
  "impressions",
  "engagements",
  "engagement",
  "followers",
];

export type MetricSpec = {
  label: string;
  /** KPI info tooltip. */
  definition: string;
  deltaFormat: DeltaFormat;
  weekly: WeeklyAggregate;
  format: (value: number) => string;
};

export const METRICS: Record<MetricId, MetricSpec> = {
  posts: {
    label: "Posts published",
    definition: "Posts marked as posted in this range",
    deltaFormat: "absolute",
    weekly: "sum",
    format: formatCount,
  },
  impressions: {
    label: "Impressions",
    definition:
      "Latest entered impressions on posts published in this range; posts without numbers are left out",
    deltaFormat: "percent",
    weekly: "sum",
    format: formatCount,
  },
  engagements: {
    label: "Engagements",
    definition: "Reactions + comments + reposts on posts published in this range",
    deltaFormat: "percent",
    weekly: "sum",
    format: formatCount,
  },
  engagement: {
    label: "Engagement rate",
    definition:
      "(Reactions + comments + reposts) ÷ impressions, over posts that have all four numbers",
    deltaFormat: "pts",
    weekly: "mean",
    format: (value) => formatPercent(value, 1),
  },
  followers: {
    label: "Followers",
    definition:
      "Total across the selected accounts at the end of the range (latest entered count). The change is the net gain over the range.",
    deltaFormat: "absolute",
    // The chart plots daily gains, so a week is the sum of its days.
    weekly: "sum",
    format: formatCount,
  },
};

export const DATE_PRESETS = [7, 28, 90] as const;
export type DatePreset = (typeof DATE_PRESETS)[number];
export const MAX_RANGE_DAYS = 366;

/* ------------------------------------------------------------- dates (UTC) */

const DAY_MS = 86_400_000;

export const utcDay = (at: number | string): string =>
  new Date(at).toISOString().slice(0, 10);

const dayMs = (day: string): number => Date.parse(`${day}T00:00:00Z`);

export function addDays(day: string, delta: number): string {
  return utcDay(dayMs(day) + delta * DAY_MS);
}

/** Inclusive list of YYYY-MM-DD days. */
export function rangeDays(start: string, end: string): string[] {
  const out: string[] = [];
  for (let at = dayMs(start); at <= dayMs(end); at += DAY_MS) out.push(utcDay(at));
  return out;
}

export function presetDates(
  preset: DatePreset,
  today: string,
): { start: string; end: string } {
  return { start: addDays(today, -(preset - 1)), end: today };
}

/** True for a valid, ordered range of at most MAX_RANGE_DAYS days. */
export function validRange(start: string, end: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end))
    return false;
  const span = (dayMs(end) - dayMs(start)) / DAY_MS + 1;
  return Number.isFinite(span) && span >= 1 && span <= MAX_RANGE_DAYS;
}

/** The equal-length period right before [start, end]. */
export function previousPeriod(
  start: string,
  end: string,
): { start: string; end: string } {
  const length = rangeDays(start, end).length;
  return { start: addDays(start, -length), end: addDays(start, -1) };
}

export function rangeLabel(start: string, end: string): string {
  return `${formatShortDate(start)} – ${formatShortDate(end)}`;
}

/* ----------------------------------------------------------------- accounts */

/** One profile on one platform: the unit the team compares. */
export type Account = {
  id: string;
  profile: Profile;
  platform: Platform;
  name: string;
  handle: string | null;
};

export const accountId = (profileId: string, platform: Platform): string =>
  `${profileId}:${platform}`;

/**
 * Accounts for the selected profiles: every platform the profile has set up,
 * plus any platform it has posts or follower counts on.
 */
export function buildAccounts(
  profiles: readonly Profile[],
  selected: ReadonlySet<string>,
  platform: PlatformFilter,
  posts: readonly Post[],
  snapshots: readonly FollowerSnapshot[],
): Account[] {
  const used = new Set<string>();
  for (const post of posts) if (post.status === "published") used.add(accountId(post.profileId, post.platform));
  for (const snap of snapshots) used.add(accountId(snap.profileId, snap.platform));
  const out: Account[] = [];
  for (const profile of [...profiles].sort((a, b) => a.sortOrder - b.sortOrder)) {
    if (!selected.has(profile.id)) continue;
    const platforms: Platform[] = ["linkedin", "x"];
    for (const p of platforms) {
      if (platform !== "all" && platform !== p) continue;
      const configured = p === "linkedin" ? profile.linkedinUrl !== null : profile.xHandle !== null;
      if (!configured && !used.has(accountId(profile.id, p))) continue;
      out.push({
        id: accountId(profile.id, p),
        profile,
        platform: p,
        name: profile.name,
        handle: p === "x" ? profile.xHandle : null,
      });
    }
  }
  return out;
}

export const accountLabel = (account: Account): string =>
  account.platform === "x" && account.handle
    ? `${account.name} (@${account.handle})`
    : account.name;

export const platformName = (platform: Platform): string =>
  platform === "x" ? "X" : "LinkedIn";

/* -------------------------------------------------------------------- posts */

/** Published posts of these accounts whose publish day is in [start, end]. */
export function postsInRange(
  posts: readonly Post[],
  accounts: readonly Account[],
  start: string,
  end: string,
): Post[] {
  const ids = new Set(accounts.map((account) => account.id));
  return posts.filter((post) => {
    if (post.status !== "published" || !post.publishedAt) return false;
    if (!ids.has(accountId(post.profileId, post.platform))) return false;
    const day = utcDay(post.publishedAt);
    return day >= start && day <= end;
  });
}

const finite = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

/** A post "has numbers" when at least one metric was entered. */
export function hasNumbers(metrics: PostMetrics | null): metrics is PostMetrics {
  return (
    metrics !== null &&
    [metrics.impressions, metrics.reactions, metrics.comments, metrics.reposts, metrics.clicks].some(finite)
  );
}

/** Reactions + comments + reposts; null unless at least one was entered. */
export function postEngagements(metrics: PostMetrics | null): number | null {
  if (!metrics) return null;
  const parts = [metrics.reactions, metrics.comments, metrics.reposts];
  if (!parts.some(finite)) return null;
  return parts.reduce<number>((sum, value) => sum + (finite(value) ? value : 0), 0);
}

/** Per-post engagement rate in percent; needs impressions > 0 and all three interactions. */
export function postRate(metrics: PostMetrics | null): number | null {
  if (!metrics || !finite(metrics.impressions) || metrics.impressions === 0) return null;
  if (!finite(metrics.reactions) || !finite(metrics.comments) || !finite(metrics.reposts)) return null;
  return ((metrics.reactions + metrics.comments + metrics.reposts) / metrics.impressions) * 100;
}

export type Totals = {
  posts: number;
  impressions: number | null;
  engagements: number | null;
  reactions: number | null;
  comments: number | null;
  reposts: number | null;
  clicks: number | null;
  /** Percent, impression-weighted over posts with all four numbers. */
  engagement: number | null;
  /** Published posts with no numbers yet. */
  pending: number;
};

/**
 * Totals over entered numbers. A post without numbers doesn't blank the
 * period: each counter sums the posts that report it and stays null when
 * none does.
 */
export function observedTotals(posts: readonly Post[]): Totals {
  const sum = (key: "impressions" | "reactions" | "comments" | "reposts" | "clicks") => {
    let total: number | null = null;
    for (const post of posts) {
      const value = post.metrics?.[key];
      if (finite(value)) total = (total ?? 0) + value;
    }
    return total;
  };
  let rateNum = 0;
  let rateDen = 0;
  let pending = 0;
  let engagements: number | null = null;
  for (const post of posts) {
    if (!hasNumbers(post.metrics)) pending++;
    const e = postEngagements(post.metrics);
    if (e !== null) engagements = (engagements ?? 0) + e;
    const m = post.metrics;
    if (postRate(m) !== null && m) {
      rateDen += m.impressions ?? 0;
      rateNum += (m.reactions ?? 0) + (m.comments ?? 0) + (m.reposts ?? 0);
    }
  }
  return {
    posts: posts.length,
    impressions: sum("impressions"),
    engagements,
    reactions: sum("reactions"),
    comments: sum("comments"),
    reposts: sum("reposts"),
    clicks: sum("clicks"),
    engagement: rateDen > 0 ? (rateNum / rateDen) * 100 : null,
    pending,
  };
}

/**
 * Signed change in `format` units: percent change, percentage points or an
 * absolute difference. Null when either side is missing, or for percent
 * without a baseline.
 */
export function metricDelta(
  current: number | null,
  previous: number | null,
  format: DeltaFormat,
): number | null {
  if (current === null || previous === null) return null;
  if (format === "percent") {
    if (previous === 0) return null;
    return ((current - previous) / Math.abs(previous)) * 100;
  }
  return current - previous;
}

/* ---------------------------------------------------------------- followers */

/** Last snapshot at or before `day` for one account, or null. */
export function followersAt(
  snapshots: readonly FollowerSnapshot[],
  account: Account,
  day: string,
): FollowerSnapshot | null {
  let best: FollowerSnapshot | null = null;
  for (const snap of snapshots) {
    if (snap.profileId !== account.profile.id || snap.platform !== account.platform) continue;
    if (snap.capturedOn > day) continue;
    if (!best || snap.capturedOn > best.capturedOn) best = snap;
  }
  return best;
}

export type AccountFollowers = {
  /** Latest count at or before the range end. */
  current: number | null;
  currentOn: string | null;
  /** Net change over the range; null without a count before or at the start. */
  change: number | null;
};

/**
 * Followers at the range end and the net change since the day before the
 * range started. If the account's first count falls inside the range, the
 * change is measured from that first count.
 */
export function accountFollowers(
  snapshots: readonly FollowerSnapshot[],
  account: Account,
  start: string,
  end: string,
): AccountFollowers {
  const now = followersAt(snapshots, account, end);
  if (!now) return { current: null, currentOn: null, change: null };
  let base = followersAt(snapshots, account, addDays(start, -1));
  if (!base) {
    const inRange = snapshots
      .filter(
        (s) =>
          s.profileId === account.profile.id &&
          s.platform === account.platform &&
          s.capturedOn >= start &&
          s.capturedOn <= end,
      )
      .sort((a, b) => a.capturedOn.localeCompare(b.capturedOn));
    base = inRange[0] ?? null;
  }
  return {
    current: now.followers,
    currentOn: now.capturedOn,
    change: base && base !== now ? now.followers - base.followers : null,
  };
}

/**
 * Daily followers gained, summed across accounts (each floored at 0, as in
 * Peacock, so one account's loss never offsets another's gain). Each carries
 * its last count forward; an account's first count sets its baseline rather
 * than counting as growth. Days before any account has data are left out, so
 * the chart never invents a zero.
 */
export function followerGrowthSeries(
  days: readonly string[],
  accounts: readonly Account[],
  snapshots: readonly FollowerSnapshot[],
): BarPoint[] {
  const first = days[0];
  if (first === undefined) return [];
  const perAccount = accounts.map((account) => {
    const points = snapshots
      .filter((s) => s.profileId === account.profile.id && s.platform === account.platform)
      .sort((a, b) => a.capturedOn.localeCompare(b.capturedOn));
    let next = 0;
    let carried: number | null = null;
    while (next < points.length && points[next].capturedOn < first) carried = points[next++].followers;
    return days.map((date) => {
      const before = carried;
      while (next < points.length && points[next].capturedOn <= date) carried = points[next++].followers;
      if (carried === null) return null;
      return before === null ? 0 : Math.max(0, carried - before);
    });
  });
  const out: BarPoint[] = [];
  days.forEach((date, index) => {
    let total: number | null = null;
    for (const gains of perAccount) {
      const value = gains[index];
      if (value !== null) total = (total ?? 0) + value;
    }
    if (total !== null) out.push({ date, value: total });
  });
  return out;
}

/* ------------------------------------------------------------------- charts */

/** Daily bars for a post metric, by publish day. Days without data are 0. */
export function postSeries(
  metric: Exclude<MetricId, "followers">,
  days: readonly string[],
  current: readonly Post[],
): BarPoint[] {
  const byDay = new Map<string, Post[]>();
  for (const post of current) {
    if (!post.publishedAt) continue;
    const day = utcDay(post.publishedAt);
    byDay.set(day, [...(byDay.get(day) ?? []), post]);
  }
  return days.map((date) => {
    const posts = byDay.get(date) ?? [];
    const totals = observedTotals(posts);
    const value = totals[metric];
    // A day with posts but no numbers is "missing", not a real zero.
    const missing = posts.length > 0 && value === null && metric !== "posts";
    return { date, value: value ?? 0, ...(missing ? { missing: true } : {}) };
  });
}

/* ------------------------------------------------------------- post tables */

export type PostRow = {
  id: string;
  post: Post;
  platform: Platform;
  title: string;
  author: string;
  date: string;
  url: string | null;
  impressions: number | null;
  engagements: number | null;
  engagement: number | null;
  clicks: number | null;
  hasNumbers: boolean;
  hasImages: boolean;
};

export type PostSort = "impressions" | "engagements" | "engagement" | "date";

export function snippet(text: string, max = 90): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (!flat) return "Untitled post";
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

export function postRows(posts: readonly Post[], profiles: readonly Profile[]): PostRow[] {
  const names = new Map(profiles.map((p) => [p.id, p.name]));
  return posts.map((post) => ({
    id: post.id,
    post,
    platform: post.platform,
    title: snippet(post.contentText),
    author: names.get(post.profileId) ?? "Unknown account",
    date: post.publishedAt ? formatShortDate(utcDay(post.publishedAt)) : MISSING,
    url: post.publishedUrl,
    impressions: finite(post.metrics?.impressions) ? (post.metrics?.impressions ?? null) : null,
    engagements: postEngagements(post.metrics),
    engagement: postRate(post.metrics),
    clicks: finite(post.metrics?.clicks) ? (post.metrics?.clicks ?? null) : null,
    hasNumbers: hasNumbers(post.metrics),
    hasImages: post.assetIds.length > 0,
  }));
}

/** Sorted descending; posts without numbers last, newest first on ties. */
export function sortPostRows(rows: readonly PostRow[], sort: PostSort): PostRow[] {
  const published = (row: PostRow) => (row.post.publishedAt ? Date.parse(row.post.publishedAt) : 0);
  const value = (row: PostRow): number =>
    sort === "date" ? published(row) : (row[sort] ?? -1);
  return [...rows].sort((a, b) => value(b) - value(a) || published(b) - published(a));
}

/* ------------------------------------------------------------------ formats */

export type FormatRow = {
  key: "images" | "text";
  label: string;
  posts: number;
  measured: number;
  avgImpressions: number | null;
  engagement: number | null;
};

/** With images vs text-only, over the posts in range. */
export function formatBreakdown(posts: readonly Post[]): FormatRow[] {
  const groups: Array<[FormatRow["key"], string, Post[]]> = [
    ["images", "With images", posts.filter((p) => p.assetIds.length > 0)],
    ["text", "Text only", posts.filter((p) => p.assetIds.length === 0)],
  ];
  return groups.map(([key, label, group]) => {
    const withImpressions = group.filter((p) => finite(p.metrics?.impressions));
    const totals = observedTotals(group);
    return {
      key,
      label,
      posts: group.length,
      measured: withImpressions.length,
      avgImpressions:
        withImpressions.length > 0 && totals.impressions !== null
          ? totals.impressions / withImpressions.length
          : null,
      engagement: totals.engagement,
    };
  });
}

/* --------------------------------------------------------------- time text */

export function relativeTime(at: string, now: number): string {
  const time = Date.parse(at);
  const minutes = Math.round((now - time) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(time).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export const SOURCE_LABEL: Record<PostMetrics["source"], string> = {
  manual: "manual",
  csv: "CSV import",
  x_api: "X API",
  linkedin_api: "LinkedIn API",
};

export const formatOrMissing = (
  value: number | null,
  format: (value: number) => string,
): string => (value === null ? MISSING : format(value));
