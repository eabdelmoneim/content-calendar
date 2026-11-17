
import { FileX, X } from "lucide-react";
import { useRef } from "react";

import { AssetMedia } from "@/features/assets/asset-media";
import type { UploadEntry } from "@/features/assets/use-asset-uploads";
import { MEDIA_ACCEPT_ATTRIBUTE } from "@/lib/media";
import type { Asset } from "@/lib/types";
import { cx, ICON_STROKE } from "@/shared/peacock/ui";

import styles from "./todo.module.css";

/** True when a drag carries files (not text or a link). */
export function dragHasFiles(event: React.DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}

/** A hidden file input for images and videos; call `open()` to pick files. */
export function useFilePicker(onFiles: (files: File[]) => void): {
  open: () => void;
  input: React.JSX.Element;
} {
  const ref = useRef<HTMLInputElement>(null);
  return {
    open: () => ref.current?.click(),
    input: (
      <input
        ref={ref}
        className="sr-only"
        type="file"
        multiple
        accept={MEDIA_ACCEPT_ATTRIBUTE}
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          onFiles(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />
    ),
  };
}

/**
 * The files on a to-do: thumbnails that open the file in a new tab, plus any
 * uploads still in flight. Attached files also live in the Assets library.
 */
export function AttachmentStrip({
  assetIds,
  assetsById,
  assetsLoading,
  uploads,
  onRemove,
  onDismissUpload,
}: {
  assetIds: readonly string[];
  assetsById: ReadonlyMap<string, Asset>;
  assetsLoading: boolean;
  uploads: readonly UploadEntry[];
  onRemove?: (assetId: string) => void;
  onDismissUpload: (uploadId: string) => void;
}): React.JSX.Element | null {
  if (assetIds.length === 0 && uploads.length === 0) return null;
  return (
    <ul className={styles.attachments} aria-label="Attached files">
      {assetIds.map((id) => {
        const asset = assetsById.get(id);
        const name = asset?.fileName ?? (assetsLoading ? "Loading…" : "File deleted from Assets");
        return (
          <li key={id} className={styles.attachment}>
            {asset ? (
              <a
                className={styles.attachmentThumb}
                href={asset.url}
                target="_blank"
                rel="noreferrer"
                title={`Open ${asset.fileName}`}
                aria-label={`Open ${asset.fileName}`}
              >
                <AssetMedia src={asset.url} mimeType={asset.mimeType} lazy />
              </a>
            ) : (
              <span className={cx(styles.attachmentThumb, styles.attachmentMissing)} title={name}>
                {assetsLoading ? null : <FileX size={16} strokeWidth={ICON_STROKE} aria-hidden />}
              </span>
            )}
            <span className={styles.attachmentName}>{name}</span>
            {onRemove ? (
              <button
                type="button"
                className={styles.attachmentRemove}
                aria-label={`Remove ${asset?.fileName ?? "file"} from this to-do`}
                title="Remove from this to-do (it stays in Assets)"
                onClick={() => onRemove(id)}
              >
                <X size={12} strokeWidth={ICON_STROKE} aria-hidden />
              </button>
            ) : null}
          </li>
        );
      })}
      {uploads.map((entry) => {
        const failed = entry.phase === "failed";
        return (
          <li key={entry.id} className={styles.attachment} data-upload={entry.phase}>
            <span
              className={cx(styles.attachmentThumb, styles.attachmentPending, failed && styles.attachmentFailed)}
              role={failed ? "alert" : "progressbar"}
              aria-label={failed ? `${entry.name}: ${entry.error ?? "upload failed"}` : `${entry.name} upload progress`}
              aria-valuemin={failed ? undefined : 0}
              aria-valuemax={failed ? undefined : 100}
              aria-valuenow={failed ? undefined : entry.progress}
            >
              {failed ? "Failed" : `${entry.progress}%`}
            </span>
            <span className={cx(styles.attachmentName, failed && styles.attachmentError)}>
              {failed ? (entry.error ?? "Upload failed") : entry.name}
            </span>
            {failed ? (
              <button
                type="button"
                className={styles.attachmentRemove}
                aria-label={`Dismiss ${entry.name}`}
                onClick={() => onDismissUpload(entry.id)}
              >
                <X size={12} strokeWidth={ICON_STROKE} aria-hidden />
              </button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
