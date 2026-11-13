"use client";

import { AssetMedia } from "@/features/assets/asset-media";
import {
  Bookmark,
  ChartNoAxesColumn,
  Heart,
  MessageCircle,
  Monitor,
  MoreHorizontal,
  Repeat2,
  Share2,
  Smartphone,
} from "lucide-react";
import { useId, useState } from "react";
import { Avatar, Segmented } from "@/shared/peacock/ui";
import type { PreviewImage } from "./linkedin-feed-preview";
import { useScaledCard } from "./use-scaled-card";
import styles from "./x-feed-preview.module.css";

export const X_STANDARD_LIMIT = 280;

type XFeedPreviewProps = {
  authorName: string;
  authorImageUrl?: string;
  username?: string;
  text: string;
  images: readonly PreviewImage[];
};

/** Peacock's X feed preview: an approximation of an X timeline post. */
export function XFeedPreview({ authorName, authorImageUrl, username, text, images }: XFeedPreviewProps): React.JSX.Element {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [expandedVersion, setExpandedVersion] = useState<string | null>(null);
  const previewVersion = `${device}:${text}`;
  const characters = Array.from(text);
  const hasCutoff = characters.length > X_STANDARD_LIMIT;
  const expanded = expandedVersion === previewVersion;
  const visibleText = hasCutoff && !expanded ? characters.slice(0, X_STANDARD_LIMIT).join("").trimEnd() : text;
  const cardWidth = device === "desktop" ? 598 : 390;
  const { feedRef, cardRef, layout } = useScaledCard(cardWidth, `${text}:${images.length}`);
  const headingId = useId();

  return (
    <section className={styles.preview} aria-labelledby={headingId}>
      <div className={styles.heading}>
        <h3 id={headingId}>Feed preview</h3>
        <Segmented
          label="Preview width"
          size="compact"
          value={device}
          onChange={setDevice}
          options={[
            {
              value: "desktop",
              ariaLabel: "Desktop preview",
              label: (
                <span className={styles.deviceLabel}>
                  <Monitor size={13} aria-hidden />
                  Desktop
                </span>
              ),
            },
            {
              value: "mobile",
              ariaLabel: "Mobile preview",
              label: (
                <span className={styles.deviceLabel}>
                  <Smartphone size={13} aria-hidden />
                  Mobile
                </span>
              ),
            },
          ]}
        />
      </div>
      <div ref={feedRef} className={styles.feed}>
        <div className={styles.scaledCard} style={{ width: cardWidth * layout.scale, height: layout.height || undefined }}>
          <article
            ref={cardRef}
            className={styles.card}
            data-device={device}
            style={{ width: cardWidth, transform: `scale(${layout.scale})` }}
            aria-label="X post preview"
          >
            <div className={styles.postContent}>
              <Avatar name={authorName} src={authorImageUrl} size={32} />
              <div className={styles.postMain}>
                <header className={styles.authorLine}>
                  <strong>{authorName}</strong>
                  {username ? <span>@{username}</span> : null}
                  <span aria-label="Preview post time">· now</span>
                  <MoreHorizontal className={styles.moreIcon} size={19} aria-hidden />
                </header>
                <div className={styles.postText} data-placeholder={!text.trim()}>
                  {text.trim() ? visibleText : "Start writing to preview your X post…"}
                </div>
                {hasCutoff && !expanded ? (
                  <button type="button" className={styles.showMore} onClick={() => setExpandedVersion(previewVersion)}>
                    Show more
                  </button>
                ) : null}
                {images.length > 0 ? (
                  <div className={styles.media} data-count={Math.min(images.length, 4)}>
                    {images.slice(0, 4).map((image) => (
                      <AssetMedia key={image.id} src={image.src} mimeType={image.mimeType} alt={image.alt} player />
                    ))}
                  </div>
                ) : null}
                <div className={styles.actions} aria-hidden>
                  <MessageCircle size={18} />
                  <Repeat2 size={18} />
                  <Heart size={18} />
                  <ChartNoAxesColumn size={18} />
                  <Bookmark size={18} />
                  <Share2 size={18} />
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>
      <p className={styles.hint}>An approximation. X decides the final truncation and image crop.</p>
    </section>
  );
}
