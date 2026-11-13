"use client";

import { Play } from "lucide-react";

import { mediaKind } from "@/lib/media";

import styles from "./asset-media.module.css";

/**
 * An asset's picture: the image itself, or a video showing its first frame.
 * `player` gives a video real controls (the asset detail); everywhere else a
 * video is a still with a play badge, like a feed thumbnail.
 */
export function AssetMedia({
  src,
  mimeType,
  alt = "",
  player = false,
  lazy = false,
}: {
  src: string;
  mimeType: string;
  alt?: string;
  player?: boolean;
  lazy?: boolean;
}): React.JSX.Element {
  if (mediaKind(mimeType) !== "video") {
    // Same-origin streamed file; Next's optimizer is bypassed on purpose.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} loading={lazy ? "lazy" : undefined} />;
  }
  if (player) {
    return <video src={src} controls playsInline preload="metadata" aria-label={alt || undefined} />;
  }
  return (
    <>
      {/* #t nudges browsers to paint the first frame instead of black. */}
      <video src={`${src}#t=0.1`} muted playsInline preload="metadata" aria-label={alt || undefined} tabIndex={-1} />
      <span className={styles.badge} aria-hidden>
        <Play size={14} fill="currentColor" />
      </span>
    </>
  );
}
