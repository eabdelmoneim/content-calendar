"use client";

import { CalendarPlus, Check, Download, ExternalLink, ImageIcon, Plus, SquarePen } from "lucide-react";
import { useMemo, useState, type DragEvent } from "react";

import { assetDownloadUrl } from "@/features/assets/asset-presentation";
import { AssetMedia } from "@/features/assets/asset-media";
import { useAssets } from "@/lib/api";
import { mediaKind } from "@/lib/media";
import type { Asset, Post } from "@/lib/types";
import { Avatar, Button, Dialog, EmptyState, Skeleton, StatusChip } from "@/shared/peacock/ui";

import { displaySpec, shortDay, type CalendarEntry } from "./calendar-model";
import { MediaLinkAnchor } from "./media-link";
import { PlatformIcon, platformName } from "./platform-icon";
import styles from "./day-view.module.css";

const APPROVED = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/**
 * One day across the whole calendar area: every post on it in time order,
 * with its full text, its media (click to view full size) and its links.
 */
export function DayView({
  date,
  open,
  entries,
  loading,
  dragOver,
  authorName,
  authorImage,
  dropProps,
  onOpen,
  onCreate,
}: {
  date: string;
  /** Today or later: new posts and drops are allowed. */
  open: boolean;
  entries: readonly CalendarEntry[];
  loading: boolean;
  dragOver: boolean;
  authorName: (profileId: string) => string;
  authorImage: (profileId: string) => string | undefined;
  dropProps: {
    onDragOver: (event: DragEvent<HTMLElement>) => void;
    onDragLeave: (event: DragEvent<HTMLElement>) => void;
    onDrop: (event: DragEvent<HTMLElement>) => void;
  };
  onOpen: (post: Post, opener: HTMLElement) => void;
  onCreate: (opener: HTMLElement) => void;
}): React.JSX.Element {
  const assets = useAssets();
  const assetById = useMemo(() => new Map((assets.data ?? []).map((asset) => [asset.id, asset])), [assets.data]);
  const [viewing, setViewing] = useState<Asset | null>(null);

  return (
    <div className={styles.root} data-drop={dragOver || undefined} {...dropProps}>
      {loading ? (
        <div className={styles.list}>
          <Skeleton height={180} radius="lg" />
          <Skeleton height={180} radius="lg" />
        </div>
      ) : entries.length === 0 ? (
        <div className={styles.empty}>
          <EmptyState
            icon={<CalendarPlus size={20} strokeWidth={1.75} />}
            title="Nothing planned for this day"
            body={open ? "Write a post for this day, or drag a draft here from Drafts." : "No posts went out this day."}
            action={
              open ? (
                <Button size="sm" icon={<Plus size={14} aria-hidden />} onClick={(event) => onCreate(event.currentTarget)}>
                  New post
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <ol className={styles.list} aria-label={`Posts on ${shortDay(date)}`}>
          {entries.map((entry) => (
            <DayPost
              key={entry.key}
              entry={entry}
              authorName={authorName(entry.profileId)}
              authorImage={authorImage(entry.profileId)}
              assetById={assetById}
              assetsLoading={assets.isPending}
              onView={setViewing}
              onOpen={onOpen}
            />
          ))}
          {open ? (
            <li className={styles.addRow}>
              <Button size="sm" icon={<Plus size={14} aria-hidden />} onClick={(event) => onCreate(event.currentTarget)}>
                New post this day
              </Button>
            </li>
          ) : null}
        </ol>
      )}
      <Dialog
        open={viewing !== null}
        onOpenChange={(next) => {
          if (!next) setViewing(null);
        }}
        size="md"
        title={viewing?.fileName ?? ""}
        actions={
          viewing ? (
            <>
              <a className={styles.dialogLink} href={viewing.url} target="_blank" rel="noreferrer">
                <ExternalLink size={13} aria-hidden /> Open full size
              </a>
              <a className={styles.dialogLink} href={assetDownloadUrl(viewing)} download={viewing.fileName}>
                <Download size={13} aria-hidden /> Download
              </a>
              <Button onClick={() => setViewing(null)}>Close</Button>
            </>
          ) : null
        }
      >
        {viewing ? (
          <div className={styles.viewer}>
            <AssetMedia src={viewing.url} mimeType={viewing.mimeType} alt={viewing.fileName} player />
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}

function DayPost({
  entry,
  authorName,
  authorImage,
  assetById,
  assetsLoading,
  onView,
  onOpen,
}: {
  entry: CalendarEntry;
  authorName: string;
  authorImage: string | undefined;
  assetById: ReadonlyMap<string, Asset>;
  assetsLoading: boolean;
  onView: (asset: Asset) => void;
  onOpen: (post: Post, opener: HTMLElement) => void;
}): React.JSX.Element {
  const { post } = entry;
  const display = displaySpec(entry.status);
  return (
    <li className={styles.post} data-platform={entry.platform}>
      <header className={styles.head}>
        <span className={styles.time}>{entry.time}</span>
        <Avatar name={authorName} src={authorImage} size={24} decorative />
        <span className={styles.author}>{authorName}</span>
        <span className={styles.platform}>
          <PlatformIcon platform={entry.platform} size={13} />
          {platformName(entry.platform)}
        </span>
        <span className={styles.spacer} />
        <StatusChip status={display.chip} label={display.label} />
        <Button
          size="sm"
          icon={<SquarePen size={13} aria-hidden />}
          onClick={(event) => onOpen(post, event.currentTarget)}
        >
          {post.status === "published" ? "View post" : "Open post"}
        </Button>
      </header>

      {post.contentText.trim() ? (
        <p className={styles.text}>{post.contentText}</p>
      ) : (
        <p className={styles.muted}>No text yet.</p>
      )}

      {post.assetIds.length > 0 ? (
        <ul className={styles.media} aria-label="Media">
          {post.assetIds.map((id) => {
            const asset = assetById.get(id);
            return (
              <li key={id}>
                {asset ? (
                  <button
                    type="button"
                    className={styles.thumb}
                    title={`View ${asset.fileName}`}
                    aria-label={`View ${mediaKind(asset.mimeType) === "video" ? "video" : "image"} ${asset.fileName}`}
                    onClick={() => onView(asset)}
                  >
                    <AssetMedia src={asset.url} mimeType={asset.mimeType} alt={asset.fileName} lazy />
                  </button>
                ) : (
                  <span className={styles.thumbMissing}>
                    <ImageIcon size={16} aria-hidden />
                    {assetsLoading ? "Loading…" : "File unavailable"}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}

      {post.mediaLinks.length > 0 ? (
        <ul className={styles.links} aria-label="Linked media">
          {post.mediaLinks.map((url) => (
            <li key={url}>
              <MediaLinkAnchor url={url} />
            </li>
          ))}
        </ul>
      ) : null}

      <footer className={styles.foot}>
        {post.approvedAt ? (
          <span className={styles.approved}>
            <Check size={13} aria-hidden /> Approved by {post.approvedByName ?? "a teammate"} ·{" "}
            {APPROVED.format(new Date(post.approvedAt))}
          </span>
        ) : null}
        {post.publishedUrl ? (
          <a className={styles.liveLink} href={post.publishedUrl} target="_blank" rel="noreferrer">
            <ExternalLink size={12} aria-hidden /> Open the live post
          </a>
        ) : null}
        {post.metrics ? (
          <span className={styles.muted}>
            {[
              post.metrics.impressions !== null ? `${post.metrics.impressions.toLocaleString("en-US")} impressions` : null,
              post.metrics.reactions !== null ? `${post.metrics.reactions.toLocaleString("en-US")} reactions` : null,
              post.metrics.comments !== null ? `${post.metrics.comments.toLocaleString("en-US")} comments` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        ) : null}
        {post.createdByName ? <span className={styles.muted}>Created by {post.createdByName}</span> : null}
      </footer>
    </li>
  );
}
