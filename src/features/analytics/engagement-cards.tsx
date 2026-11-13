"use client";

import { LayoutList, Plus, Users } from "lucide-react";
import { Card, CardHeader, GrowthText } from "@/shared/peacock/data";
import { Avatar, Button, IconButton } from "@/shared/peacock/ui";
import { formatCount, formatPercent, formatSignedCount, formatShortDate, MISSING } from "@/shared/peacock/format";
import type { Account, AccountFollowers, FormatRow, Totals } from "./analytics-model";
import { platformName } from "./analytics-model";
import { PlatformMark } from "./brand-icons";
import styles from "./analytics.module.css";

export type AccountSummary = {
  account: Account;
  totals: Totals;
  followers: AccountFollowers;
};

/**
 * Per-account breakdown (profile × platform), in the look of Peacock's
 * "Top engagers" card: who is ripping, ranked by impressions.
 */
export function AccountsCard({
  rows,
  onAddFollowers,
}: {
  rows: AccountSummary[];
  onAddFollowers: (accountId: string | null) => void;
}): React.JSX.Element {
  const sorted = [...rows].sort(
    (a, b) =>
      (b.totals.impressions ?? -1) - (a.totals.impressions ?? -1) ||
      (b.totals.engagements ?? -1) - (a.totals.engagements ?? -1) ||
      b.totals.posts - a.totals.posts,
  );
  return (
    <Card aria-labelledby="analytics-accounts">
      <CardHeader
        id="analytics-accounts"
        icon={<Users size={15} />}
        title="Accounts"
        actions={
          <Button size="sm" variant="ghost" icon={<Plus size={14} />} onClick={() => onAddFollowers(null)}>
            Add follower count
          </Button>
        }
      />
      <p className={styles.audienceHint}>Each account in this range · ranked by impressions</p>
      {sorted.length === 0 ? (
        <p className={styles.audienceEmpty}>No accounts match these filters.</p>
      ) : (
        <ol className={styles.engagerList}>
          {sorted.map(({ account, totals, followers }) => (
            <li key={account.id} className={styles.engagerRow}>
              <Avatar
                name={account.name}
                src={account.profile.avatarUrl ?? undefined}
                size={32}
                decorative
                badge={<PlatformMark platform={account.platform} size={10} />}
              />
              <span className={styles.engagerIdentity}>
                <span className={styles.engagerName}>
                  {account.name}
                  <span className={styles.accountPlatform}>
                    {" "}
                    · {account.platform === "x" && account.handle ? `@${account.handle}` : platformName(account.platform)}
                  </span>
                </span>
                <span className={styles.engagerHeadline}>
                  {formatCount(totals.posts)} {totals.posts === 1 ? "post" : "posts"} ·{" "}
                  {totals.impressions === null ? "no impressions yet" : `${formatCount(totals.impressions)} impressions`}
                  {totals.engagements !== null ? ` · ${formatCount(totals.engagements)} engagements` : ""}
                  {totals.engagement !== null ? ` · ${formatPercent(totals.engagement, 1)}` : ""}
                </span>
              </span>
              <span className={styles.engagerCounts}>
                <strong title={followers.currentOn ? `Entered for ${formatShortDate(followers.currentOn)}` : undefined}>
                  <span className="sr-only">Followers </span>
                  {followers.current === null ? MISSING : formatCount(followers.current)}
                </strong>
                <span>
                  {followers.current === null ? (
                    "no follower count"
                  ) : followers.change === null ? (
                    "followers"
                  ) : (
                    <GrowthText tone={followers.change > 0 ? "positive" : followers.change < 0 ? "negative" : "neutral"}>
                      {formatSignedCount(followers.change)}
                    </GrowthText>
                  )}
                </span>
              </span>
              <IconButton
                size="sm"
                aria-label={`Add follower count for ${account.name} on ${platformName(account.platform)}`}
                icon={<Plus size={14} />}
                onClick={() => onAddFollowers(account.id)}
              />
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

/** With images vs text-only, in the look of Peacock's "Top companies" bars. */
export function FormatCard({ rows }: { rows: FormatRow[] }): React.JSX.Element {
  const max = Math.max(1, ...rows.map((row) => row.avgImpressions ?? 0));
  return (
    <Card aria-labelledby="analytics-format">
      <CardHeader id="analytics-format" icon={<LayoutList size={15} />} title="Post format" />
      <p className={styles.audienceHint}>Average impressions per post with numbers</p>
      {rows.every((row) => row.posts === 0) ? (
        <p className={styles.audienceEmpty}>Nothing was published in this range.</p>
      ) : (
        <ol className={styles.companyList}>
          {rows.map((row) => (
            <li key={row.key} className={styles.companyRow}>
              <span
                className={styles.companyBar}
                style={{ width: `${((row.avgImpressions ?? 0) / max) * 100}%` }}
                aria-hidden
              />
              <span className={styles.companyName}>{row.label}</span>
              <span className={styles.companyInteractions}>
                {formatCount(row.posts)} {row.posts === 1 ? "post" : "posts"}
                {row.engagement !== null ? ` · ${formatPercent(row.engagement, 1)} eng.` : ""}
              </span>
              <strong className={styles.companyPeople}>
                {row.avgImpressions === null ? MISSING : formatCount(row.avgImpressions)}{" "}
                <span className={styles.peopleLabel}>avg</span>
              </strong>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
