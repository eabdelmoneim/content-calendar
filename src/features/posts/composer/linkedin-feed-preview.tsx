"use client";

import { AssetMedia } from "@/features/assets/asset-media";
import { Globe2, MessageCircle, Monitor, MoreHorizontal, Repeat2, Send, Smartphone, ThumbsUp } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Avatar, Segmented } from "@/shared/peacock/ui";
import cardStyles from "./linkedin-card.module.css";
import styles from "./linkedin-feed-preview.module.css";
import { useScaledCard } from "./use-scaled-card";

export type PreviewImage = { id: string; src: string; alt: string; mimeType: string };

type LinkedInFeedPreviewProps = {
  authorName: string;
  authorHeadline?: string;
  authorImageUrl?: string;
  text: string;
  images: readonly PreviewImage[];
  /** Shown under the author, e.g. "Thu, Oct 29". Defaults to "Now". */
  when?: string;
};

/** Typegrow reference: three visual lines before "...more". */
const MAX_LINES = 3;
const LINE_HEIGHT = 20;
const MAX_TILES = 5;

function PostText({ text, resetKey }: { text: string; resetKey: string }): React.JSX.Element {
  const textRef = useRef<HTMLDivElement>(null);
  const textId = useId();
  const [overflows, setOverflows] = useState(false);
  const [expandedVersion, setExpandedVersion] = useState<string | null>(null);
  const version = `${resetKey}:${text}`;
  const expanded = expandedVersion === version;
  const hasText = text.trim().length > 0;

  useEffect(() => {
    const element = textRef.current;
    if (!element) return;
    const measure = () => setOverflows(element.scrollHeight > MAX_LINES * LINE_HEIGHT + 1);
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(element);
    return () => observer?.disconnect();
  }, [text, resetKey]);

  return (
    <div className={cardStyles.body}>
      <div
        className={cardStyles.textContainer}
        data-collapsed={!expanded}
        style={{ maxHeight: expanded ? undefined : MAX_LINES * LINE_HEIGHT }}
      >
        <div ref={textRef} id={textId} className={cardStyles.text} data-placeholder={!hasText}>
          {hasText ? text : "Start writing to preview your LinkedIn post…"}
        </div>
        {overflows && !expanded ? (
          <button
            type="button"
            className={cardStyles.seeMore}
            aria-label="See more"
            aria-expanded={false}
            aria-controls={textId}
            onClick={() => setExpandedVersion(version)}
          >
            ...more
          </button>
        ) : null}
      </div>
      {overflows && expanded ? (
        <button
          type="button"
          className={cardStyles.seeLess}
          aria-expanded
          aria-controls={textId}
          onClick={() => setExpandedVersion(null)}
        >
          see less
        </button>
      ) : null}
    </div>
  );
}

/** Peacock's LinkedIn feed preview: an approximation of a LinkedIn feed card. */
export function LinkedInFeedPreview({
  authorName,
  authorHeadline,
  authorImageUrl,
  text,
  images,
  when,
}: LinkedInFeedPreviewProps): React.JSX.Element {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const cardWidth = device === "desktop" ? 555 : 390;
  const { feedRef, cardRef, layout } = useScaledCard(cardWidth, `${text}:${images.length}`);
  const labelId = useId();

  return (
    <section className={styles.preview} aria-labelledby={labelId}>
      <div className={styles.heading}>
        <h3 id={labelId}>Feed preview</h3>
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
      <div className={styles.feed} ref={feedRef}>
        <div
          className={styles.scaledCard}
          style={{ width: cardWidth * layout.scale, height: layout.height || undefined }}
        >
          <article
            ref={cardRef}
            className={`${cardStyles.card} ${cardStyles.preview}`}
            data-device={device}
            style={{ width: cardWidth, transform: `scale(${layout.scale})` }}
            aria-label="LinkedIn post preview"
          >
            <header className={cardStyles.author}>
              <Avatar name={authorName} src={authorImageUrl} size={32} />
              <div className={cardStyles.authorDetails}>
                <strong>{authorName}</strong>
                {authorHeadline ? <span>{authorHeadline}</span> : null}
                <span className={cardStyles.visibility}>
                  <span>{when ?? "Now"} ·</span>
                  <Globe2 size={12} aria-label="Public" role="img" />
                </span>
              </div>
              <MoreHorizontal className={cardStyles.moreIcon} size={22} aria-hidden />
            </header>
            <PostText text={text} resetKey={device} />
            {images.length > 0 ? (
              <div
                className={cardStyles.images}
                data-count={Math.min(images.length, MAX_TILES)}
                data-layout="preview"
                role="group"
                aria-label={`${images.length} attached ${images.length === 1 ? "image" : "images"}`}
              >
                {images.slice(0, MAX_TILES).map((image, index) => (
                  <div className={cardStyles.imageTile} key={image.id}>
                    <AssetMedia src={image.src} mimeType={image.mimeType} alt={image.alt} player />
                    {index === MAX_TILES - 1 && images.length > MAX_TILES ? (
                      <span className={cardStyles.moreImages}>+{images.length - MAX_TILES}</span>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
            <div className={cardStyles.actions} aria-hidden>
              <span>
                <ThumbsUp size={19} />
                Like
              </span>
              <span>
                <MessageCircle size={19} />
                Comment
              </span>
              <span>
                <Repeat2 size={19} />
                Repost
              </span>
              <span>
                <Send size={19} />
                Send
              </span>
            </div>
          </article>
        </div>
      </div>
      <p className={styles.hint}>An approximation. LinkedIn decides the final truncation and image crop.</p>
    </section>
  );
}
