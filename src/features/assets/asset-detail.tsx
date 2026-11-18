"use client";

import { mediaKind } from "@/lib/media";

import { AssetMedia } from "./asset-media";
import { Check, ChevronRight, Download, PenSquare, Trash2 } from "lucide-react";
import Link from "next/link";
import { useId, useState, type FormEvent } from "react";

import { useRenameAsset } from "@/lib/api";
import { platformLabel } from "@/lib/share-links";
import type { Asset, Post, Profile } from "@/lib/types";
import {
  Button,
  cx,
  ICON_STROKE,
  Input,
  Skeleton,
  StatusChip,
} from "@/shared/peacock/ui";
import buttonStyles from "@/shared/peacock/ui/button.module.css";

import {
  assetDownloadUrl,
  blockingPosts,
  formatDimensions,
  formatFileSize,
  inUseCopy,
  newPostHref,
  postHref,
  uploadedLabel,
  usageChip,
} from "./asset-presentation";
import { sanitizeDownloadFileName } from "./download-name";
import styles from "./assets.module.css";

const ICON = { size: 14, strokeWidth: ICON_STROKE } as const;

function postTitle(post: Post): string {
  const firstLine = post.contentText.trim().split(/\n/)[0]?.trim();
  return firstLine || "Untitled post";
}

/**
 * Body of the asset detail (desktop side panel, mobile bottom sheet):
 * preview, name, facts, where it's used, New post, Download and Delete.
 */
export function AssetDetailBody({
  asset,
  posts,
  profiles,
  onRequestDelete,
}: {
  asset: Asset;
  /** Every post in the workspace; undefined while loading. */
  posts: readonly Post[] | undefined;
  profiles: readonly Profile[];
  onRequestDelete: () => void;
}): React.JSX.Element {
  const usageHeadingId = useId();
  const deleteHintId = useId();
  const usedIn = posts?.filter((post) => asset.usedInPostIds.includes(post.id));
  const blocked = usedIn ? blockingPosts(usedIn).length : 0;
  const profileName = (id: string) =>
    profiles.find((profile) => profile.id === id)?.name;

  return (
    <div className={styles.detailBody}>
      <div className={styles.detailPreview}>
        <AssetMedia
          src={asset.url}
          mimeType={asset.mimeType}
          alt={asset.fileName}
          player
        />
      </div>

      <RenameForm key={`${asset.id}:${asset.fileName}`} asset={asset} />

      <dl className={styles.facts}>
        <dt>Dimensions</dt>
        <dd>{formatDimensions(asset.width, asset.height)}</dd>
        <dt>Size</dt>
        <dd>{formatFileSize(asset.sizeBytes)}</dd>
        <dt>Uploaded</dt>
        <dd>{uploadedLabel(asset.createdByName, asset.createdAt)}</dd>
      </dl>

      <section className={styles.usage} aria-labelledby={usageHeadingId}>
        <h3 id={usageHeadingId} className={styles.usageHeading}>
          {asset.usedInPostIds.length > 0
            ? `Used in ${asset.usedInPostIds.length} ${asset.usedInPostIds.length === 1 ? "post" : "posts"}`
            : "Used in"}
        </h3>
        {usedIn === undefined ? (
          <div className={styles.usageLoading} aria-busy="true">
            <Skeleton height={36} radius="md" />
            <Skeleton height={36} radius="md" />
          </div>
        ) : usedIn.length === 0 ? (
          <p className={styles.muted}>Not used in any post.</p>
        ) : (
          <ul className={styles.usageList}>
            {usedIn.map((post) => {
              const chip = usageChip(post.status);
              return (
                <li key={post.id}>
                  <Link
                    className={styles.usageRow}
                    href={postHref(post.id)}
                    aria-label={`Open post: ${postTitle(post)}`}
                  >
                    <span className={styles.usageText}>
                      <span className={styles.usageTitle}>
                        {postTitle(post)}
                      </span>
                      <span className={styles.usageMeta}>
                        {[
                          profileName(post.profileId),
                          platformLabel(post.platform),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <StatusChip
                      status={chip.status}
                      {...(chip.label ? { label: chip.label } : {})}
                    />
                    <ChevronRight
                      {...ICON}
                      className={styles.usageChevron}
                      aria-hidden
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className={styles.detailActions}>
        <Link
          className={cx(
            buttonStyles.button,
            buttonStyles.md,
            buttonStyles.secondary,
            styles.actionButton,
          )}
          href={newPostHref(asset.id)}
        >
          <span className={buttonStyles.icon} aria-hidden>
            <PenSquare {...ICON} />
          </span>
          New post with this{" "}
          {mediaKind(asset.mimeType) === "video" ? "video" : "image"}
        </Link>
      </div>

      <div className={styles.detailActions}>
        <a
          className={cx(
            buttonStyles.button,
            buttonStyles.md,
            buttonStyles.secondary,
            styles.actionButton,
          )}
          href={assetDownloadUrl(asset)}
          download={sanitizeDownloadFileName(asset.fileName, asset.mimeType)}
        >
          <span className={buttonStyles.icon} aria-hidden>
            <Download {...ICON} />
          </span>
          Download
        </a>
        <Button
          variant="destructive-secondary"
          className={styles.actionButton}
          icon={<Trash2 {...ICON} />}
          disabled={blocked > 0 || usedIn === undefined}
          aria-describedby={blocked > 0 ? deleteHintId : undefined}
          onClick={onRequestDelete}
        >
          Delete
        </Button>
      </div>
      {blocked > 0 ? (
        <p id={deleteHintId} className={styles.hint}>
          {inUseCopy(blocked)}
        </p>
      ) : null}
    </div>
  );
}

function RenameForm({ asset }: { asset: Asset }): React.JSX.Element {
  const rename = useRenameAsset();
  const [name, setName] = useState(asset.fileName);
  const [saved, setSaved] = useState(false);
  const dirty = name.trim() !== asset.fileName && name.trim().length > 0;

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!dirty) return;
    setSaved(false);
    rename.mutate(
      { id: asset.id, fileName: name.trim() },
      { onSuccess: () => setSaved(true) },
    );
  }

  return (
    <form className={styles.renameForm} onSubmit={submit} noValidate>
      <Input
        label="Name"
        value={name}
        maxLength={200}
        autoComplete="off"
        disabled={rename.isPending}
        error={
          rename.isError
            ? rename.error.message
            : name.trim().length === 0
              ? "Give the file a name."
              : undefined
        }
        hint={saved && !dirty ? "Saved." : undefined}
        fieldClassName={styles.renameField}
        onChange={(event) => {
          setName(event.target.value);
          setSaved(false);
          if (rename.isError) rename.reset();
        }}
      />
      {dirty ? (
        <Button
          type="submit"
          size="md"
          className={styles.renameSave}
          icon={<Check {...ICON} />}
          loading={rename.isPending}
          loadingLabel="Saving…"
        >
          Save
        </Button>
      ) : null}
    </form>
  );
}
