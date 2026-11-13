"use client";

import { ExternalLink, Link2 } from "lucide-react";

import { mediaLinkKind, mediaLinkLabel } from "@/lib/media-links";

import styles from "./media-link.module.css";

/** Opens a YouTube / Google Drive link in a new tab, labelled with where it lives. */
export function MediaLinkAnchor({ url }: { url: string }): React.JSX.Element {
  const label = mediaLinkLabel(mediaLinkKind(url));
  const shown = url.replace(/^https:\/\/(www\.)?/, "");
  return (
    <a className={styles.mediaLink} href={url} target="_blank" rel="noreferrer" title={`Open on ${label}`}>
      <Link2 size={13} aria-hidden />
      <span className={styles.source}>{label}</span>
      <span className={styles.url}>{shown}</span>
      <ExternalLink size={12} aria-hidden />
    </a>
  );
}
