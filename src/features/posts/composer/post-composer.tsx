"use client";

import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarCheck,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  Download,
  ExternalLink,
  FileX,
  Globe,
  ImageIcon,
  ImagePlus,
  Images,
  LoaderCircle,
  Plus,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useApprovePost,
  useAssets,
  useDeletePost,
  usePublishAction,
  useSavePost,
  useUploadAssets,
} from "@/lib/api";
import { MAX_MEDIA_LINKS, mediaLinkKind, mediaLinkLabel, parseMediaLink } from "@/lib/media-links";
import { MediaLinkAnchor } from "../media-link";
import { shareLink } from "@/lib/share-links";
import { AssetMedia } from "@/features/assets/asset-media";
import { sanitizeDownloadFileName } from "@/features/assets/download-name";
import {
  LINKEDIN_IMAGE_LIMIT,
  MEDIA_ACCEPT_ATTRIBUTE,
  X_IMAGE_LIMIT,
  mediaKind,
  postMediaProblem,
} from "@/lib/media";
import { type Asset, type Platform, type Post, type PostInput, type Profile } from "@/lib/types";
import {
  Avatar,
  Button,
  Dialog,
  EmptyState,
  IconButton,
  InlineAlert,
  Input,
  StatusChip,
} from "@/shared/peacock/ui";
import { addDays, clock, postTitle, shortDay, toInstant, todayKey, whenLabel } from "../calendar-model";
import { PlatformIcon, platformName } from "../platform-icon";
import { NEVER_POSTS, accountPhrase, publishPanel } from "../publish-copy";
import { closeModal, ComposerShell, SettingsSection } from "./composer-shell";
import { LinkedInFeedPreview, type PreviewImage } from "./linkedin-feed-preview";
import { PostEditor, textToHtml } from "./post-editor";
import { handOffMedia, handoffMessage } from "./media-handoff";
import { timeZoneLabel } from "./time-zone";
import { X_STANDARD_LIMIT, XFeedPreview } from "./x-feed-preview";
import styles from "./composer.module.css";

export type PostComposerTarget =
  | { mode: "create"; profileId?: string; date?: string; time?: string; assetIds?: readonly string[] }
  | { mode: "edit"; post: Post };

export type PostComposerProps = {
  target: PostComposerTarget;
  /** Live posts list; the composer follows its post through refetches. */
  posts: readonly Post[];
  /** Every account (edit) — a post can be reopened even if its account is not selected. */
  profiles: readonly Profile[];
  /** Accounts offered for a new post: the top-bar selection. */
  createProfiles: readonly Profile[];
  onClose: () => void;
  /** Confirmation for the page toast after the composer closes. */
  onClosedWithMessage: (message: string) => void;
  onNavigateToDate: (date: string) => void;
};

const LINKEDIN_LIMIT = 3_000;

type Snapshot = {
  author: string;
  html: string;
  text: string;
  assetIds: readonly string[];
  mediaLinks: readonly string[];
  scheduledAt: string | null;
};

function authorKey(platform: Platform, profileId: string): string {
  return `${platform}:${profileId}`;
}

function parseAuthor(key: string): { platform: Platform; profileId: string } {
  const [platform, ...rest] = key.split(":");
  return { platform: platform === "x" ? "x" : "linkedin", profileId: rest.join(":") };
}

function platformsOf(profile: Profile): Platform[] {
  return [...(profile.linkedinUrl ? (["linkedin"] as const) : []), ...(profile.xHandle ? (["x"] as const) : [])];
}

function snapshotOf(post: Post): Snapshot {
  return {
    author: authorKey(post.platform, post.profileId),
    html: post.contentHtml || textToHtml(post.contentText),
    text: post.contentText,
    assetIds: post.assetIds,
    mediaLinks: post.mediaLinks,
    scheduledAt: post.scheduledAt,
  };
}

function sameInstant(left: string | null, right: string | null): boolean {
  if (left === null || right === null) return left === right;
  // The composer edits to the minute; stored times may carry seconds.
  return Math.floor(Date.parse(left) / 60_000) === Math.floor(Date.parse(right) / 60_000);
}

/** Read at event time only (never during render). */
function wallClock(): number {
  return Date.now();
}

function errorText(caught: unknown, fallback: string): string {
  return caught instanceof Error && caught.message ? caught.message : fallback;
}

const APPROVED = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

/**
 * One composer for LinkedIn and X (Peacock's PostComposer + XComposer,
 * unified): pick the account and platform, write in TipTap, attach images,
 * pick a date and time, then Save draft or Schedule. The Publishing panel
 * walks a saved post through approval and manual posting.
 */
export function PostComposer({
  target,
  posts,
  profiles,
  createProfiles,
  onClose,
  onClosedWithMessage,
  onNavigateToDate,
}: PostComposerProps): React.JSX.Element {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const save = useSavePost();
  const remove = useDeletePost();
  const approve = useApprovePost();
  const publish = usePublishAction();
  const upload = useUploadAssets();
  const assets = useAssets();

  const initialPost = target.mode === "edit" ? target.post : null;
  const [postId, setPostId] = useState<string | null>(initialPost?.id ?? null);
  const livePost = postId ? (posts.find((post) => post.id === postId) ?? null) : null;
  // Until the list refetches after creating, keep the record the save returned.
  const [lastSaved, setLastSaved] = useState<Post | null>(initialPost);
  const post = livePost ?? (lastSaved?.id === postId ? lastSaved : null);
  const missing = postId !== null && post === null;

  const authorProfiles = (postId === null ? createProfiles : profiles).filter(
    (profile) => platformsOf(profile).length > 0,
  );
  const [initialSnapshot] = useState<Snapshot>(() => {
    if (initialPost) return snapshotOf(initialPost);
    const create = target.mode === "create" ? target : null;
    const preferred =
      authorProfiles.find((profile) => profile.id === create?.profileId) ?? authorProfiles[0];
    const platform = preferred ? (platformsOf(preferred)[0] ?? "linkedin") : "linkedin";
    const date = create?.date ?? addDays(todayKey(), 1);
    const time = create?.time ?? "09:00";
    return {
      author: preferred ? authorKey(platform, preferred.id) : "",
      html: "",
      text: "",
      assetIds: create?.assetIds ?? [],
      mediaLinks: [],
      scheduledAt: toInstant(date, time),
    };
  });
  const [saved, setSaved] = useState<Snapshot | null>(initialPost ? initialSnapshot : null);
  const [author, setAuthor] = useState(initialSnapshot.author);
  const [html, setHtml] = useState(initialSnapshot.html);
  const [text, setText] = useState(initialSnapshot.text);
  const [assetIds, setAssetIds] = useState<readonly string[]>(initialSnapshot.assetIds);
  const [mediaLinks, setMediaLinks] = useState<readonly string[]>(initialSnapshot.mediaLinks);
  const [linkDraft, setLinkDraft] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState(
    initialSnapshot.scheduledAt ? clock(initialSnapshot.scheduledAt).date : "",
  );
  const [scheduleTime, setScheduleTime] = useState(
    initialSnapshot.scheduledAt ? clock(initialSnapshot.scheduledAt).time : "",
  );
  const [previewOpen, setPreviewOpen] = useState(false);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [closeConfirming, setCloseConfirming] = useState(false);
  const [marking, setMarking] = useState(false);
  const [markUrl, setMarkUrl] = useState("");
  const [liveUrl, setLiveUrl] = useState(initialPost?.publishedUrl ?? "");
  const [now] = useState(() => Date.now());

  const { platform, profileId } = parseAuthor(author);
  const profile = profiles.find((candidate) => candidate.id === profileId);
  const authorName = profile?.name ?? "Choose an account";
  const published = post?.status === "published";
  const locked = published || missing;
  const scheduledAt = scheduleDate && scheduleTime ? toInstant(scheduleDate, scheduleTime) : null;
  const hasSchedule = scheduledAt !== null;
  const characterCount = Array.from(text).length;
  const limit = platform === "x" ? X_STANDARD_LIMIT : LINKEDIN_LIMIT;
  const characterLevel = characterCount > limit ? "over" : characterCount > limit * 0.85 ? "warn" : "ok";
  const dirty =
    saved === null
      ? text.trim().length > 0 || assetIds.length > 0 || mediaLinks.length > 0
      : saved.author !== author ||
        saved.html !== html ||
        saved.text !== text ||
        saved.assetIds.join(",") !== assetIds.join(",") ||
        saved.mediaLinks.join("\n") !== mediaLinks.join("\n") ||
        !sameInstant(saved.scheduledAt, scheduledAt);
  const pending = save.isPending || remove.isPending || approve.isPending || publish.isPending;
  const busy = pending || upload.isPending;

  const assetById = useMemo(() => new Map((assets.data ?? []).map((asset) => [asset.id, asset])), [assets.data]);
  const attached = assetIds.map((id) => ({ id, asset: assetById.get(id) }));
  const previewImages: PreviewImage[] = attached.flatMap(({ id, asset }) =>
    asset ? [{ id, src: asset.url, alt: asset.fileName, mimeType: asset.mimeType }] : [],
  );
  const imageLimit = platform === "x" ? X_IMAGE_LIMIT : LINKEDIN_IMAGE_LIMIT;
  const hasVideo = attached.some(({ asset }) => asset !== undefined && mediaKind(asset.mimeType) === "video");
  // Unknown (still loading) assets count as images until the library arrives.
  const mediaIssue = postMediaProblem(
    platform,
    attached.map(({ asset }) => asset?.mimeType ?? "image/jpeg"),
  );
  const mediaFull = hasVideo || assetIds.length >= imageLimit;
  const tz = timeZoneLabel(Intl.DateTimeFormat().resolvedOptions().timeZone, scheduleDate || undefined);
  const when = scheduleDate && scheduleTime ? whenLabel(scheduleDate, scheduleTime) : null;

  function edited(): void {
    setError(null);
    setStatus(null);
    setCloseConfirming(false);
  }

  async function persist(scheduled: boolean): Promise<void> {
    if (!profile) {
      setError("Choose the account that posts this.");
      return;
    }
    if (scheduled) {
      if (!scheduledAt) {
        setError("Pick a date and time to schedule.");
        return;
      }
      const changedTime = !sameInstant(post?.scheduledAt ?? null, scheduledAt);
      if (changedTime && Date.parse(scheduledAt) <= wallClock()) {
        setError("That time has already passed. Pick a time in the future.");
        return;
      }
      if (text.trim().length === 0 && assetIds.length === 0 && mediaLinks.length === 0) {
        setError("Write something before scheduling.");
        return;
      }
      if (characterCount > limit) {
        setError(
          platform === "x"
            ? `X posts are limited to ${X_STANDARD_LIMIT} characters without X Premium. Shorten it by ${characterCount - limit}.`
            : `LinkedIn posts are limited to ${LINKEDIN_LIMIT.toLocaleString("en-US")} characters.`,
        );
        return;
      }
    }
    if (mediaIssue) {
      setError(mediaIssue);
      return;
    }
    const input: PostInput = {
      profileId,
      platform,
      contentHtml: html,
      contentText: text,
      scheduledAt: scheduled ? scheduledAt : null,
      assetIds: [...assetIds],
      mediaLinks: [...mediaLinks],
    };
    setError(null);
    setStatus(null);
    try {
      const result = await save.mutateAsync({ id: postId, input });
      setPostId(result.id);
      setLastSaved(result);
      setSaved(snapshotOf(result));
      if (!scheduled) {
        setScheduleDate("");
        setScheduleTime("");
      }
      setStatus(
        scheduled && result.scheduledAt
          ? `Scheduled for ${whenLabel(clock(result.scheduledAt).date, clock(result.scheduledAt).time)}.${result.approvedAt ? "" : " It needs approval before it can be posted."}`
          : "Saved as a draft.",
      );
    } catch (caught) {
      setError(errorText(caught, "The post could not be saved. Try again."));
    }
  }

  function finishClose(): void {
    closeModal(dialogRef.current);
    onClose();
  }

  function requestClose(): void {
    if (dirty && !locked) setCloseConfirming(true);
    else finishClose();
  }

  async function handleDelete(): Promise<void> {
    if (!postId) return;
    try {
      await remove.mutateAsync(postId);
      setDeleteConfirming(false);
      closeModal(dialogRef.current);
      onClosedWithMessage("Post deleted.");
    } catch (caught) {
      setDeleteConfirming(false);
      setError(errorText(caught, "The post could not be deleted."));
    }
  }

  async function handleApprove(): Promise<void> {
    if (!postId) return;
    setError(null);
    try {
      const result = await approve.mutateAsync(postId);
      setLastSaved(result);
      setStatus(`Approved by ${result.approvedByName ?? "you"}.`);
    } catch (caught) {
      setError(errorText(caught, "The post could not be approved."));
    }
  }

  async function handlePublish(
    body: { action: "mark"; publishedUrl: string | null } | { action: "set_url"; publishedUrl: string | null } | { action: "unmark" },
    done: string,
  ): Promise<boolean> {
    if (!postId) return false;
    setError(null);
    try {
      const result = await publish.mutateAsync({ id: postId, body });
      setLastSaved(result);
      setSaved(snapshotOf(result));
      setLiveUrl(result.publishedUrl ?? "");
      setStatus(done);
      return true;
    } catch (caught) {
      setError(errorText(caught, "That didn't work. Try again."));
      return false;
    }
  }

  async function handleFiles(files: File[]): Promise<void> {
    if (files.length === 0) return;
    if (hasVideo) {
      setError(`${platformName(platform)} posts take one video on its own. Remove it to add more.`);
      return;
    }
    const room = imageLimit - assetIds.length;
    if (room <= 0) {
      setError(`${platformName(platform)} allows up to ${imageLimit} images.`);
      return;
    }
    const accepted = files.slice(0, room);
    edited();
    try {
      const uploaded = await upload.mutateAsync(accepted);
      setAssetIds((current) => [...current, ...uploaded.map((asset) => asset.id)]);
      if (accepted.length < files.length)
        setError(`Only ${accepted.length} of ${files.length} files were added: ${platformName(platform)} allows ${imageLimit} images.`);
    } catch (caught) {
      setError(errorText(caught, "The file could not be uploaded."));
    }
  }

  function toggleAsset(id: string): void {
    edited();
    setAssetIds((current) => {
      if (current.includes(id)) return current.filter((existing) => existing !== id);
      const next = [...current, id];
      const problem = postMediaProblem(
        platform,
        next.map((existing) => assetById.get(existing)?.mimeType ?? "image/jpeg"),
      );
      if (problem) {
        setError(problem);
        return current;
      }
      return next;
    });
  }

  function addMediaLink(raw: string): void {
    edited();
    const parsed = parseMediaLink(raw);
    if (!parsed.ok) {
      setLinkError(parsed.message);
      return;
    }
    if (mediaLinks.includes(parsed.url)) {
      setLinkError("That link is already on this post.");
      return;
    }
    if (mediaLinks.length >= MAX_MEDIA_LINKS) {
      setLinkError(`A post can carry up to ${MAX_MEDIA_LINKS} links.`);
      return;
    }
    setLinkError(null);
    setLinkDraft("");
    setMediaLinks((current) => [...current, parsed.url]);
  }

  function removeMediaLink(url: string): void {
    edited();
    setLinkError(null);
    setMediaLinks((current) => current.filter((existing) => existing !== url));
  }

  function moveAsset(index: number, step: -1 | 1): void {
    edited();
    setAssetIds((current) => {
      const next = [...current];
      const [item] = next.splice(index, 1);
      if (item === undefined) return current;
      next.splice(index + step, 0, item);
      return next;
    });
  }

  const crumb = missing ? "Post unavailable" : postTitle(text) === "Untitled post" && postId === null ? "New post" : postTitle(text);
  const saveIndicator = save.isPending ? (
    <span className={styles.saving}>
      <LoaderCircle size={13} className={styles.spin} aria-hidden />
      Saving…
    </span>
  ) : locked ? null : saved === null ? (
    <span className={styles.saving}>Not saved yet</span>
  ) : dirty ? (
    <span className={styles.saving}>Unsaved changes</span>
  ) : (
    <StatusChip status="draft_saved" label="Saved" />
  );

  const isScheduled = post?.status === "scheduled";
  const secondary = locked ? null : (
    <Button disabled={busy || !profile} onClick={() => void persist(false)}>
      {isScheduled ? "Move to drafts" : "Save draft"}
    </Button>
  );
  const primary = locked ? null : (
    <Button
      variant="primary"
      icon={<CalendarCheck size={15} aria-hidden />}
      loading={save.isPending}
      disabled={busy || !profile || !hasSchedule || (isScheduled && !dirty)}
      title={!hasSchedule ? "Pick a date and time to schedule." : isScheduled && !dirty ? "No changes to save." : undefined}
      onClick={() => void persist(true)}
    >
      {isScheduled ? "Update" : "Schedule"}
    </Button>
  );

  const authorOptions = authorProfiles.flatMap((candidate) =>
    platformsOf(candidate).map((option) => ({
      value: authorKey(option, candidate.id),
      label: `${platformName(option)} · ${candidate.name}${option === "x" && candidate.xHandle ? ` (@${candidate.xHandle})` : ""}`,
    })),
  );
  if (profile && !authorOptions.some((option) => option.value === author))
    authorOptions.unshift({ value: author, label: `${platformName(platform)} · ${profile.name}` });

  const editor = missing ? (
    <div className={styles.center}>
      <EmptyState
        headingLevel={3}
        icon={<FileX size={20} aria-hidden />}
        title="This post is no longer available"
        body="It was deleted by someone else. Close the composer to go back to the calendar."
        action={<Button onClick={finishClose}>Close</Button>}
      />
    </div>
  ) : authorOptions.length === 0 ? (
    <div className={styles.center}>
      <EmptyState
        headingLevel={3}
        icon={<Globe size={20} aria-hidden />}
        title="No account can post yet"
        body="Add a LinkedIn page or an X handle to an account in Settings, then write the post here."
        action={
          <Link className={styles.link} href="/settings">
            Open Settings
          </Link>
        }
      />
    </div>
  ) : (
    <>
      <div className={styles.authorRow}>
        {locked ? (
          <span className={styles.authorStatic}>
            <Avatar name={authorName} src={profile?.avatarUrl ?? undefined} size={24} decorative />
            <PlatformIcon platform={platform} size={13} />
            <strong>
              {platformName(platform)} · {authorName}
            </strong>
          </span>
        ) : (
          <label className={styles.authorButton}>
            <Avatar name={authorName} src={profile?.avatarUrl ?? undefined} size={24} decorative />
            <PlatformIcon platform={platform} size={13} />
            {platformName(platform)} · {authorName}
            <ChevronDown size={14} aria-hidden />
            <select
              aria-label="Post account and platform"
              value={author}
              disabled={busy}
              onChange={(event) => {
                edited();
                setAuthor(event.target.value);
              }}
            >
              {authorOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        )}
        {platform === "x" && profile?.xHandle ? <span className={styles.authorMeta}>@{profile.xHandle}</span> : null}
        {platform === "linkedin" && profile?.linkedinUrl ? (
          <span className={styles.authorMeta}>{profile.linkedinUrl.replace(/^https?:\/\/(www\.)?/, "")}</span>
        ) : null}
      </div>

      <section aria-label="Post text">
        <PostEditor
          initialHtml={initialSnapshot.html}
          disabled={locked}
          describedBy={locked ? undefined : "post-character-count"}
          imagesDisabled={busy || mediaFull}
          onAddImage={() => imageInputRef.current?.click()}
          onChange={(nextHtml, nextText) => {
            edited();
            setHtml(nextHtml);
            setText(nextText);
          }}
        />
      </section>

      {locked ? null : (
      <div className={styles.editorFoot}>
        <span>
          {platform === "x"
            ? "Formatting is dropped on X. Posts over 280 characters need X Premium."
            : "Enter for a new paragraph · Shift+Enter for a line break · Formatting is dropped when posted"}
        </span>
        <span id="post-character-count" className={styles.counter} data-level={characterLevel}>
          <span className={styles.counterTrack} aria-hidden>
            <span
              className={styles.counterFill}
              data-level={characterLevel}
              style={{ width: `${Math.min(100, Math.round((characterCount / limit) * 100))}%` }}
            />
          </span>
          {characterCount.toLocaleString("en-US")} / {limit.toLocaleString("en-US")}
        </span>
      </div>
      )}

      {locked && assetIds.length === 0 && mediaLinks.length === 0 ? null : (
      <section className={styles.messages} aria-label="Media">
        <div className={styles.imagesHead}>
          <h3 className={styles.imagesTitle}>
            Media{" "}
            <span className={styles.imagesNote}>
              {hasVideo ? "1 video" : `${assetIds.length} / ${imageLimit}`}
            </span>
          </h3>
          {locked ? null : (
            <span className={styles.imagesNote}>
              Up to {imageLimit} images (10 MB each) or one video (300 MB)
            </span>
          )}
        </div>
        <input
          ref={imageInputRef}
          type="file"
          multiple
          accept={MEDIA_ACCEPT_ATTRIBUTE}
          aria-label="Upload post images or video"
          className="sr-only"
          disabled={locked || busy}
          onChange={(event) => {
            void handleFiles(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
        <ul className={styles.imageGrid} aria-label="Attached media">
          {attached.map(({ id, asset }, index) => (
            <li key={id} className={styles.imageTile} data-over={index >= imageLimit || undefined}>
              {asset ? (
                <AssetMedia src={asset.url} mimeType={asset.mimeType} alt={asset.fileName} />
              ) : (
                <span className={styles.imageMissing}>
                  <ImageIcon size={18} aria-hidden />
                  {assets.isPending ? "Loading…" : "File unavailable"}
                </span>
              )}
              {locked ? null : (
                <>
                  <IconButton
                    className={styles.imageRemove}
                    aria-label={`Remove ${asset?.fileName ?? "image"}`}
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    icon={<X size={13} aria-hidden />}
                    onClick={() => toggleAsset(id)}
                  />
                  {attached.length > 1 ? (
                    <span className={styles.imageOrder}>
                      <IconButton
                        aria-label={`Move ${asset?.fileName ?? "image"} earlier`}
                        size="sm"
                        variant="secondary"
                        disabled={busy || index === 0}
                        icon={<ArrowLeft size={13} aria-hidden />}
                        onClick={() => moveAsset(index, -1)}
                      />
                      <IconButton
                        aria-label={`Move ${asset?.fileName ?? "image"} later`}
                        size="sm"
                        variant="secondary"
                        disabled={busy || index === attached.length - 1}
                        icon={<ArrowRight size={13} aria-hidden />}
                        onClick={() => moveAsset(index, 1)}
                      />
                    </span>
                  ) : null}
                </>
              )}
            </li>
          ))}
          {locked ? null : (
            <>
              <li>
                <button
                  type="button"
                  className={styles.imageAdd}
                  disabled={busy || mediaFull}
                  onClick={() => imageInputRef.current?.click()}
                >
                  {upload.isPending ? (
                    <LoaderCircle size={18} className={styles.spin} aria-hidden />
                  ) : (
                    <ImagePlus size={18} aria-hidden />
                  )}
                  {upload.isPending ? "Uploading…" : "Upload"}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className={styles.imageAdd}
                  data-variant="assets"
                  disabled={busy}
                  aria-expanded={assetPickerOpen}
                  onClick={() => setAssetPickerOpen((open) => !open)}
                >
                  <Images size={18} aria-hidden />
                  Choose from Assets
                </button>
              </li>
            </>
          )}
        </ul>
        {mediaIssue ? (
          <InlineAlert tone="danger">{mediaIssue}</InlineAlert>
        ) : null}
        {assetPickerOpen && !locked ? (
          <AssetPicker
            assets={assets.data}
            loading={assets.isPending}
            error={assets.error}
            onRetry={() => void assets.refetch()}
            selected={assetIds}
            onToggle={toggleAsset}
          />
        ) : null}
        {locked && mediaLinks.length === 0 ? null : (
        <div className={styles.mediaLinks}>
          <div className={styles.imagesHead}>
            <h4 className={styles.mediaLinksTitle}>
              Links{" "}
              <span className={styles.imagesNote}>
                {mediaLinks.length} / {MAX_MEDIA_LINKS}
              </span>
            </h4>
            {locked ? null : (
              <span className={styles.imagesNote}>For bigger files: a YouTube or Google Drive link</span>
            )}
          </div>
          {mediaLinks.length > 0 ? (
            <ul className={styles.mediaLinkList} aria-label="Linked media">
              {mediaLinks.map((url) => (
                <li key={url} className={styles.mediaLinkItem}>
                  <MediaLinkAnchor url={url} />
                  {locked ? null : (
                    <IconButton
                      aria-label={`Remove ${mediaLinkLabel(mediaLinkKind(url))} link`}
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      icon={<X size={13} aria-hidden />}
                      onClick={() => removeMediaLink(url)}
                    />
                  )}
                </li>
              ))}
            </ul>
          ) : null}
          {locked || mediaLinks.length >= MAX_MEDIA_LINKS ? null : (
            <form
              className={styles.urlRow}
              onSubmit={(event) => {
                event.preventDefault();
                event.stopPropagation();
                addMediaLink(linkDraft);
              }}
            >
              <Input
                aria-label="YouTube or Google Drive link"
                placeholder="https://youtu.be/… or https://drive.google.com/…"
                value={linkDraft}
                disabled={busy}
                onChange={(event) => {
                  setLinkError(null);
                  setLinkDraft(event.target.value);
                }}
                fieldClassName={styles.urlField}
              />
              <Button
                size="sm"
                type="submit"
                icon={<Plus size={13} aria-hidden />}
                disabled={busy || linkDraft.trim().length === 0}
              >
                Add link
              </Button>
            </form>
          )}
          {linkError ? <InlineAlert tone="danger">{linkError}</InlineAlert> : null}
        </div>
        )}
      </section>
      )}
    </>
  );

  const panel = post && !dirty ? publishPanel({ post, nowMs: now, authorName, xHandle: profile?.xHandle ?? null }) : null;
  const downloadable = (post?.assetIds ?? []).flatMap((id) => {
    const asset = assetById.get(id);
    return asset ? [asset] : [];
  });

  const publishing =
    post === null ? (
      <div className={styles.publish}>
        <div className={styles.publishHead}>
          <span>Publishing</span>
        </div>
        <p className={styles.publishBody}>
          Save the post, then someone approves it. {NEVER_POSTS} When it&rsquo;s time, a person presses Post on X or LinkedIn and marks it here.
        </p>
      </div>
    ) : dirty && !locked ? (
      <div className={styles.publish} data-tone="warning">
        <div className={styles.publishHead}>
          <span>Publishing</span>
          <StatusChip status="draft_saved" label="Unsaved changes" />
        </div>
        <p className={styles.publishTitle}>Save your changes first</p>
        <p className={styles.publishBody}>
          Approval covers the exact saved post. Saving a change to the text, media, links or account asks for approval
          again.
        </p>
      </div>
    ) : panel ? (
      <div className={styles.publish} data-tone={panel.tone}>
        <div className={styles.publishHead}>
          <span>Publishing</span>
          <StatusChip status={panel.chip} label={panel.chipLabel} />
        </div>
        <p className={styles.publishTitle}>{panel.title}</p>
        <p className={styles.publishBody}>{panel.body}</p>
        {post.approvedAt ? (
          <p className={styles.approvedBy}>
            <Check size={13} aria-hidden />
            Approved by {post.approvedByName ?? "a teammate"} · {APPROVED.format(new Date(post.approvedAt))}
          </p>
        ) : null}
        {panel.step === "approve" ? (
          <div className={styles.publishActions}>
            <Button
              variant="primary"
              icon={<Check size={14} aria-hidden />}
              loading={approve.isPending}
              disabled={busy || (post.contentText.trim().length === 0 && post.assetIds.length === 0 && post.mediaLinks.length === 0)}
              title={post.contentText.trim().length === 0 && post.assetIds.length === 0 && post.mediaLinks.length === 0 ? "Write something first." : undefined}
              onClick={() => void handleApprove()}
            >
              Approve this post
            </Button>
          </div>
        ) : null}
        {panel.step === "post" ? (
          <div className={styles.publishActions}>
            <Button
              variant="primary"
              icon={<PlatformIcon platform={post.platform} size={13} />}
              iconRight={<ExternalLink size={13} aria-hidden />}
              disabled={busy}
              onClick={() => {
                const handoff = handOffMedia(downloadable);
                window.open(shareLink(post.platform, post.contentText), "_blank", "noopener,noreferrer");
                void handoff.then((result) => setStatus(handoffMessage(platformName(post.platform), result)));
              }}
            >
              Post on {platformName(post.platform)}
            </Button>
            <p className={styles.muted}>
              Opens {platformName(post.platform)}&rsquo;s composer with the text filled in. Check you&rsquo;re signed in
              as {accountPhrase(post.platform, authorName, profile?.xHandle ?? null)}
              {downloadable.length > 0
                ? `, attach the media, then press Post there. ${platformName(post.platform)} won't take media through a link, so this button also downloads it${downloadable.some((asset) => mediaKind(asset.mimeType) === "image") ? " and copies the first image for pasting" : ""}.`
                : ", then press Post there."}
            </p>
            {post.platform === "x" && Array.from(post.contentText).length > X_STANDARD_LIMIT ? (
              <InlineAlert tone="warning">Over 280 characters: X only accepts this from a Premium account.</InlineAlert>
            ) : null}
            {downloadable.length > 0 ? (
              <div className={styles.downloads}>
                <p className={styles.dragHint}>
                  {downloadable.some((asset) => mediaKind(asset.mimeType) === "image")
                    ? `Drag an image straight into the ${platformName(post.platform)} composer.`
                    : null}
                  {downloadable.some((asset) => mediaKind(asset.mimeType) === "video")
                    ? ` Browsers can't drag video between windows: download it, then drag it in from your Downloads folder.`
                    : null}
                </p>
                <ul className={styles.dragTray} aria-label="Media to attach">
                  {downloadable.map((asset, index) => {
                    const image = mediaKind(asset.mimeType) === "image";
                    return (
                      <li key={asset.id} className={styles.dragItem}>
                        {image ? (
                          // A real <img> is what browsers hand over as a file when dropped
                          // on another window; the full file, not a resized thumbnail.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            className={styles.dragThumb}
                            src={`${asset.url}/${encodeURIComponent(sanitizeDownloadFileName(asset.fileName, asset.mimeType))}`}
                            alt={asset.fileName}
                            draggable
                            title={`Drag ${asset.fileName} into ${platformName(post.platform)}`}
                          />
                        ) : (
                          <span className={styles.dragThumb} data-video>
                            <AssetMedia src={asset.url} mimeType={asset.mimeType} alt={asset.fileName} />
                          </span>
                        )}
                        <a
                          className={styles.link}
                          href={`${asset.url}?download=1`}
                          download={asset.fileName}
                          draggable={false}
                          title={`Download ${asset.fileName}`}
                        >
                          <Download size={12} aria-hidden /> {index + 1}. {asset.fileName}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
            {post.mediaLinks.length > 0 ? (
              <div className={styles.downloads}>
                <p className={styles.dragHint}>
                  Linked media: open it, download the file, then drag it into the {platformName(post.platform)} composer.
                  Or paste a YouTube link into the post text.
                </p>
                <ul className={styles.mediaLinkList} aria-label="Linked media to attach">
                  {post.mediaLinks.map((url) => (
                    <li key={url} className={styles.mediaLinkItem}>
                      <MediaLinkAnchor url={url} />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <Button
              icon={<Check size={14} aria-hidden />}
              disabled={busy}
              onClick={() => {
                setMarkUrl("");
                setMarking(true);
              }}
            >
              Mark as posted
            </Button>
          </div>
        ) : null}
        {panel.step === "live" ? (
          <div className={styles.publishActions}>
            {post.publishedUrl ? (
              <a className={styles.link} href={post.publishedUrl} target="_blank" rel="noreferrer">
                <ExternalLink size={12} aria-hidden /> Open the live post
              </a>
            ) : null}
            <form
              className={styles.urlRow}
              onSubmit={(event) => {
                event.preventDefault();
                void handlePublish(
                  { action: "set_url", publishedUrl: liveUrl.trim() || null },
                  liveUrl.trim() ? "Live link saved." : "Live link removed.",
                );
              }}
            >
              <Input
                aria-label="Live post link"
                placeholder={post.platform === "x" ? "https://x.com/…/status/…" : "https://www.linkedin.com/posts/…"}
                value={liveUrl}
                disabled={busy}
                onChange={(event) => setLiveUrl(event.target.value)}
                fieldClassName={styles.urlField}
              />
              <Button
                size="sm"
                type="submit"
                disabled={busy || liveUrl.trim() === (post.publishedUrl ?? "")}
              >
                {post.publishedUrl ? "Update" : "Add link"}
              </Button>
            </form>
            <button
              type="button"
              className={styles.clearButton}
              disabled={busy}
              onClick={() =>
                void handlePublish({ action: "unmark" }, "Marked as not posted. It's back in the schedule.")
              }
            >
              Not posted? Undo
            </button>
          </div>
        ) : null}
      </div>
    ) : null;

  const settings = missing ? null : (
    <>
      <SettingsSection>
        <div className={styles.sectionTitle}>
          <strong>Schedule</strong>
          <span className={styles.when}>
            {published && post?.publishedAt
              ? `Posted ${whenLabel(clock(post.publishedAt).date, clock(post.publishedAt).time)}`
              : when
                ? `${when} ${tz.abbreviation}`
                : "Not scheduled. Pick a date to schedule, or save it as a draft."}
          </span>
        </div>
        {published ? null : (
          <>
            <div className={styles.dateRow}>
              <label className={styles.fieldLabel}>
                Date
                <span className={styles.fieldControl}>
                  <CalendarDays size={14} aria-hidden />
                  <input
                    type="date"
                    value={scheduleDate}
                    min={todayKey()}
                    disabled={busy}
                    onChange={(event) => {
                      edited();
                      setScheduleDate(event.target.value);
                      if (event.target.value && !scheduleTime) setScheduleTime("09:00");
                    }}
                  />
                </span>
              </label>
              <label className={styles.fieldLabel}>
                Time
                <span className={styles.fieldControl}>
                  <Clock3 size={14} aria-hidden />
                  <input
                    type="time"
                    step={60}
                    value={scheduleTime}
                    disabled={busy}
                    onChange={(event) => {
                      edited();
                      setScheduleTime(event.target.value);
                    }}
                  />
                </span>
              </label>
            </div>
            <div className={styles.fieldLabel}>
              Timezone
              <span className={styles.fieldControl} title="Posts use this device's time zone.">
                <Globe size={14} aria-hidden />
                <span>{tz.label}</span>
              </span>
            </div>
            {hasSchedule && !isScheduled ? (
              <button
                type="button"
                className={styles.clearButton}
                onClick={() => {
                  edited();
                  setScheduleDate("");
                  setScheduleTime("");
                }}
              >
                Clear date and time
              </button>
            ) : null}
          </>
        )}
      </SettingsSection>

      <SettingsSection>
        {publishing}
        <div className={styles.messages}>
          {error ? <InlineAlert tone="danger">{error}</InlineAlert> : null}
          {status ? <InlineAlert tone="success">{status}</InlineAlert> : null}
        </div>
      </SettingsSection>

      {post ? (
        <SettingsSection className={styles.grow}>
          <p className={styles.muted}>
            {post.createdByName ? `Created by ${post.createdByName}` : "Created"} ·{" "}
            {shortDay(clock(post.createdAt).date)}
            {post.updatedByName && post.updatedByName !== post.createdByName
              ? ` · Last edited by ${post.updatedByName}`
              : ""}
          </p>
        </SettingsSection>
      ) : null}
    </>
  );

  const settingsFooter =
    post && (scheduleDate || post.publishedAt) ? (
      <button
        type="button"
        className={styles.clearButton}
        onClick={() => {
          const date = post.status === "published" && post.publishedAt ? clock(post.publishedAt).date : scheduleDate;
          closeModal(dialogRef.current);
          onNavigateToDate(date);
        }}
      >
        View in calendar <ArrowUpRight size={12} aria-hidden />
      </button>
    ) : null;

  return (
    <ComposerShell
      dialogRef={dialogRef}
      crumb={crumb}
      saveIndicator={saveIndicator}
      previewOpen={previewOpen}
      onPreviewChange={setPreviewOpen}
      previewDisabled={missing}
      onRequestDelete={postId !== null && !locked ? () => setDeleteConfirming(true) : undefined}
      deleteDisabled={busy}
      closeDisabled={remove.isPending}
      secondary={secondary}
      primary={primary}
      onRequestClose={requestClose}
      summary={
        published ? "Posted" : when ? `${when} ${tz.abbreviation}${post && !post.approvedAt ? " · needs approval" : ""}` : "Not scheduled"
      }
      settings={settings}
      settingsFooter={settingsFooter}
      preview={
        platform === "x" ? (
          <XFeedPreview
            authorName={authorName}
            authorImageUrl={profile?.avatarUrl ?? undefined}
            username={profile?.xHandle ?? undefined}
            text={text}
            images={previewImages}
          />
        ) : (
          <LinkedInFeedPreview
            authorName={authorName}
            authorHeadline={profile?.kind === "company" ? "Company page" : undefined}
            authorImageUrl={profile?.avatarUrl ?? undefined}
            text={text}
            images={previewImages}
            when={scheduleDate ? shortDay(scheduleDate) : undefined}
          />
        )
      }
      overlay={
        <>
          <Dialog
            open={deleteConfirming}
            onOpenChange={(open) => {
              if (!remove.isPending) setDeleteConfirming(open);
            }}
            title="Delete this post?"
            description="This removes the post and its schedule. Images stay in Assets."
            actions={
              <>
                <Button disabled={remove.isPending} onClick={() => setDeleteConfirming(false)}>
                  Cancel
                </Button>
                <Button variant="danger" loading={remove.isPending} onClick={() => void handleDelete()}>
                  Delete post
                </Button>
              </>
            }
          />
          <Dialog
            open={marking}
            onOpenChange={(open) => {
              if (!publish.isPending) setMarking(open);
            }}
            title="Mark this post as posted?"
            description={`Only do this once it's live on ${platformName(platform)} (${accountPhrase(platform, authorName, profile?.xHandle ?? null)}). Content Calendar records it; nothing is sent to ${platformName(platform)}.`}
            actions={
              <>
                <Button disabled={publish.isPending} onClick={() => setMarking(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  loading={publish.isPending}
                  onClick={() =>
                    void handlePublish(
                      { action: "mark", publishedUrl: markUrl.trim() || null },
                      "Marked as posted.",
                    ).then((ok) => {
                      if (ok) setMarking(false);
                    })
                  }
                >
                  Mark as posted
                </Button>
              </>
            }
          >
            <div className={styles.urlRow} data-align="end">
              <Input
                label="Link to the live post (optional)"
                placeholder={platform === "x" ? "https://x.com/…/status/…" : "https://www.linkedin.com/posts/…"}
                value={markUrl}
                onChange={(event) => setMarkUrl(event.target.value)}
                fieldClassName={styles.urlField}
              />
            </div>
            {error && marking ? <InlineAlert tone="danger">{error}</InlineAlert> : null}
          </Dialog>
          {closeConfirming ? (
            <div className={styles.closeConfirm} role="alert">
              <div>
                <strong>You have unsaved changes</strong>
                <p>Keep editing and save them, or close and discard them.</p>
              </div>
              <div className={styles.closeConfirmActions}>
                <Button size="sm" variant="ghost" onClick={() => setCloseConfirming(false)}>
                  Keep editing
                </Button>
                <Button size="sm" variant="destructive-secondary" onClick={finishClose}>
                  Discard changes
                </Button>
              </div>
            </div>
          ) : null}
        </>
      }
    >
      {editor}
    </ComposerShell>
  );
}

function AssetPicker({
  assets,
  loading,
  error,
  onRetry,
  selected,
  onToggle,
}: {
  assets: readonly Asset[] | undefined;
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
  selected: readonly string[];
  onToggle: (id: string) => void;
}): React.JSX.Element {
  const pickerRef = useRef<HTMLDivElement>(null);

  // The picker opens under the image row, which is usually below the fold, so
  // without this the click looks like it did nothing. Bring it into view on open.
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    pickerRef.current?.scrollIntoView?.({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
  }, []);

  return (
    <div ref={pickerRef} className={styles.assetPicker}>
      {error ? (
        <InlineAlert
          tone="danger"
          action={
            <Button size="sm" onClick={onRetry}>
              Try again
            </Button>
          }
        >
          {error.message || "Assets could not be loaded."}
        </InlineAlert>
      ) : loading ? (
        <p className={styles.muted} role="status">
          Loading assets…
        </p>
      ) : !assets || assets.length === 0 ? (
        <p className={styles.muted}>
          Nothing in the library yet. Upload one above, or{" "}
          <Link className={styles.link} href="/assets">
            open Assets
          </Link>
          .
        </p>
      ) : (
        <ul aria-label="Asset library">
          {assets.map((asset) => {
            const on = selected.includes(asset.id);
            return (
              <li key={asset.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  aria-label={`${on ? "Remove" : "Attach"} ${asset.fileName}`}
                  onClick={() => onToggle(asset.id)}
                >
                  <span className={styles.pickerThumb}>
                    <AssetMedia src={asset.url} mimeType={asset.mimeType} lazy />
                  </span>
                  <span>{asset.fileName}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
