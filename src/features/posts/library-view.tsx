"use client";

import { CalendarClock, FilePen, Search, Send } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Card, DataTable, EntityCell } from "@/shared/peacock/data";
import { formatCount } from "@/shared/peacock/format";
import { Avatar, Button, EmptyState, InlineAlert, Input, Select, Skeleton, StatusChip } from "@/shared/peacock/ui";
import type { Platform, Post, Profile } from "@/lib/types";
import { clock, displaySpec, displayStatus, postTitle, relativeUpdated, whenLabel } from "./calendar-model";
import { PlatformIcon, platformName } from "./platform-icon";
import { POSTS_MOBILE_QUERY, useMediaQuery } from "./use-media-query";
import styles from "./library-view.module.css";

const SEARCH_MAX = 200;

export type LibraryKind = "drafts" | "upcoming" | "published";

export type LibraryViewProps = {
  kind: LibraryKind;
  /** Posts of the selected profiles (all states); this view picks its own. */
  posts: readonly Post[];
  profiles: readonly Profile[];
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
  /** Wall clock, read after mount; null until then. */
  now: number | null;
  onOpen: (post: Post) => void;
  onNewPost: (opener: HTMLElement) => void;
  onOpenScheduler: () => void;
};

function AuthorCell({ profile, platform }: { profile: Profile | undefined; platform: Platform }): React.JSX.Element {
  const name = profile?.name ?? "Unknown account";
  return (
    <span className={styles.author}>
      <Avatar name={name} src={profile?.avatarUrl ?? undefined} size={20} decorative />
      <span className={styles.authorName}>{name}</span>
      <PlatformIcon platform={platform} size={12} />
      <span className="sr-only">{platformName(platform)}</span>
    </span>
  );
}

type MobileRow = {
  id: string;
  title: string;
  authorName: string;
  authorImageUrl?: string;
  platform: Platform;
  date: string;
  trailing?: ReactNode;
  onOpen: () => void;
};

/** Below 768px the table becomes Peacock's stacked list in its card. */
function MobileList({ label, rows }: { label: string; rows: readonly MobileRow[] }): React.JSX.Element {
  return (
    <Card className={styles.mobileCard}>
      <ul className={styles.mobileList} aria-label={label}>
        {rows.map((row) => (
          <li key={row.id} className={styles.mobileItem}>
            <button type="button" className={styles.mobileRow} onClick={row.onOpen}>
              <span className={styles.mobileTitleLine}>
                <span className={styles.mobileTitle}>{row.title}</span>
                {row.trailing}
              </span>
              <span className={styles.mobileMeta}>
                <Avatar name={row.authorName} src={row.authorImageUrl} size={16} decorative />
                <span className={styles.authorName}>{row.authorName}</span>
                <PlatformIcon platform={row.platform} size={12} />
                <span className="sr-only">{platformName(row.platform)}</span>
                <span aria-hidden>·</span>
                <span className={styles.mobileDate}>{row.date}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

const COPY: Record<LibraryKind, { label: string; search: string; emptyTitle: string; emptyBody: string }> = {
  drafts: {
    label: "Drafts",
    search: "Search drafts",
    emptyTitle: "No drafts",
    emptyBody: "Posts without a date land here.",
  },
  upcoming: {
    label: "Upcoming posts",
    search: "Search upcoming posts",
    emptyTitle: "Nothing scheduled",
    emptyBody: "Scheduled posts that haven't been marked as posted show here, soonest first.",
  },
  published: {
    label: "Posted",
    search: "Search posted posts",
    emptyTitle: "Nothing posted yet",
    emptyBody: "Posts appear here once someone posts them on X or LinkedIn and marks them as posted.",
  },
};

function whenOf(post: Post): string {
  const at = post.status === "published" ? (post.publishedAt ?? post.scheduledAt) : post.scheduledAt;
  if (!at) return "—";
  const { date, time } = clock(at);
  return whenLabel(date, time);
}

/** Drafts, Upcoming and Posted tabs: Peacock's library table over our posts. */
export function LibraryView({
  kind,
  posts,
  profiles,
  loading,
  error,
  onRetry,
  now,
  onOpen,
  onNewPost,
  onOpenScheduler,
}: LibraryViewProps): React.JSX.Element {
  const mobile = useMediaQuery(POSTS_MOBILE_QUERY);
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("all");
  const copy = COPY[kind];
  const profileById = useMemo(() => new Map(profiles.map((profile) => [profile.id, profile])), [profiles]);
  const all = useMemo(() => {
    switch (kind) {
      case "drafts":
        return posts
          .filter((post) => post.status === "draft")
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
      case "upcoming":
        return posts
          .filter((post) => post.status === "scheduled")
          .sort((left, right) => (left.scheduledAt ?? "").localeCompare(right.scheduledAt ?? ""));
      case "published":
        return posts
          .filter((post) => post.status === "published")
          .sort((left, right) => (right.publishedAt ?? "").localeCompare(left.publishedAt ?? ""));
    }
  }, [kind, posts]);
  const needle = search.trim().toLowerCase();
  const rows = all.filter(
    (post) =>
      (platform === "all" || post.platform === platform) && (!needle || post.contentText.toLowerCase().includes(needle)),
  );
  const filtered = Boolean(needle) || platform !== "all";
  const nowMs = now ?? 0;
  const chip = (post: Post) => {
    const display = displaySpec(displayStatus(post, nowMs));
    return <StatusChip status={display.chip} label={display.label} />;
  };
  const dateText = (post: Post) =>
    kind === "drafts" ? (now ? `Updated ${relativeUpdated(post.updatedAt, now)}` : "") : whenOf(post);

  return (
    <div className={styles.view}>
      <div className={styles.toolbar}>
        <Input
          type="search"
          aria-label={copy.search}
          placeholder={copy.search}
          icon={<Search size={14} aria-hidden />}
          value={search}
          maxLength={SEARCH_MAX}
          fieldClassName={styles.search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Select
          aria-label="Platform"
          value={platform}
          onChange={(event) => setPlatform(event.target.value)}
          options={[
            { value: "all", label: "All platforms" },
            { value: "linkedin", label: "LinkedIn" },
            { value: "x", label: "X" },
          ]}
        />
      </div>
      {error ? (
        <InlineAlert
          tone="danger"
          action={
            <Button size="sm" onClick={onRetry}>
              Try again
            </Button>
          }
        >
          {error.message || `${copy.label} could not be loaded. Try again.`}
        </InlineAlert>
      ) : loading || now === null ? (
        <Card padding="flush" aria-busy>
          <div className={styles.skeletons}>
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} height={40} radius="md" />
            ))}
          </div>
        </Card>
      ) : rows.length === 0 ? (
        filtered && all.length > 0 ? (
          <Card className={styles.emptyCard}>
            <EmptyState
              icon={<Search size={20} strokeWidth={1.75} />}
              title={`No ${copy.label.toLowerCase()} match`}
              body="Try another word or platform."
              action={
                <Button
                  onClick={() => {
                    setSearch("");
                    setPlatform("all");
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          </Card>
        ) : (
          <Card className={styles.emptyCard}>
            <EmptyState
              icon={
                kind === "drafts" ? (
                  <FilePen size={20} strokeWidth={1.75} />
                ) : kind === "upcoming" ? (
                  <CalendarClock size={20} strokeWidth={1.75} />
                ) : (
                  <Send size={20} strokeWidth={1.75} />
                )
              }
              title={copy.emptyTitle}
              body={copy.emptyBody}
              action={
                kind === "published" ? (
                  <Button onClick={onOpenScheduler}>Open scheduler</Button>
                ) : (
                  <Button onClick={(event) => onNewPost(event.currentTarget)}>New post</Button>
                )
              }
            />
          </Card>
        )
      ) : mobile ? (
        <MobileList
          label={copy.label}
          rows={rows.map((post) => {
            const profile = profileById.get(post.profileId);
            return {
              id: post.id,
              title: postTitle(post.contentText),
              authorName: profile?.name ?? "Unknown account",
              authorImageUrl: profile?.avatarUrl ?? undefined,
              platform: post.platform,
              date: dateText(post),
              trailing: chip(post),
              onOpen: () => onOpen(post),
            };
          })}
        />
      ) : (
        <Card padding="flush" className={styles.tableCard}>
          <DataTable
            className={styles.table}
            label={copy.label}
            rows={rows}
            getRowId={(post) => post.id}
            onRowActivate={(post) => onOpen(post)}
            columns={[
              {
                key: "post",
                header: "Post",
                width: "minmax(0, 2.6fr)",
                render: (post) => (
                  <EntityCell
                    title={postTitle(post.contentText)}
                    subline={post.contentText.replace(/\s+/g, " ").trim() || "No text yet"}
                  />
                ),
              },
              {
                key: "author",
                header: "Account",
                width: "minmax(0, 1fr)",
                render: (post) => <AuthorCell profile={profileById.get(post.profileId)} platform={post.platform} />,
              },
              {
                key: "status",
                header: "Status",
                width: "156px",
                render: (post) => chip(post),
              },
              kind === "published"
                ? {
                    key: "impressions",
                    header: "Impressions",
                    width: "104px",
                    numeric: true,
                    render: (post: Post) => formatCount(post.metrics?.impressions),
                  }
                : {
                    key: "images",
                    header: "Images",
                    width: "72px",
                    numeric: true,
                    render: (post: Post) => (post.assetIds.length > 0 ? post.assetIds.length : "—"),
                  },
              {
                key: "when",
                header: kind === "drafts" ? "Updated" : kind === "upcoming" ? "Scheduled" : "Posted",
                width: kind === "drafts" ? "120px" : "150px",
                render: (post) => <span className={styles.subtle}>{dateText(post)}</span>,
              },
            ]}
          />
        </Card>
      )}
    </div>
  );
}
