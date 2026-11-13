"use client";

import { FilePen, GripVertical, Plus, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { Avatar, Button, EmptyState, IconButton, Skeleton } from "@/shared/peacock/ui";
import type { Post } from "@/lib/types";
import { postTitle } from "./calendar-model";
import { PlatformIcon, platformName } from "./platform-icon";
import styles from "./scheduler.module.css";

export const DRAFT_DRAG_TYPE = "application/x-content-calendar-draft";

export type DraftsPanelProps = {
  drafts: readonly Post[];
  loading: boolean;
  authorName: (profileId: string) => string;
  authorImage: (profileId: string) => string | undefined;
  onClose: () => void;
  onNewDraft: (opener: HTMLElement) => void;
  onOpen: (draft: Post, opener: HTMLElement) => void;
  onDragStart: (draft: Post) => void;
  onDragEnd: () => void;
};

/**
 * Drafts side sheet (296px), Peacock's Ideas panel showing unscheduled
 * drafts. Not modal: the calendar stays interactive so a draft can be dragged
 * onto a day. Esc closes it.
 */
export function DraftsPanel({
  drafts,
  loading,
  authorName,
  authorImage,
  onClose,
  onNewDraft,
  onOpen,
  onDragStart,
  onDragEnd,
}: DraftsPanelProps): React.JSX.Element {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  return (
    <aside
      className={styles.ideas}
      aria-labelledby="posts-drafts-title"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <header className={styles.ideasHeader}>
        <h2 id="posts-drafts-title" ref={headingRef} tabIndex={-1} className={styles.ideasTitle}>
          Drafts <span className={styles.ideasCount}>{loading ? "" : drafts.length}</span>
        </h2>
        <Button
          variant="ghost"
          size="sm"
          icon={<Plus size={14} aria-hidden />}
          onClick={(event) => onNewDraft(event.currentTarget)}
        >
          Draft
        </Button>
        <IconButton aria-label="Close drafts" size="sm" icon={<X size={15} strokeWidth={1.75} />} onClick={onClose} />
      </header>
      <p className={styles.ideasHelp}>Drag onto a day to schedule it for 09:00.</p>
      <div className={styles.ideasList} aria-busy={loading || undefined}>
        {loading ? (
          Array.from({ length: 4 }, (_, index) => <Skeleton key={index} height={64} radius="md" />)
        ) : drafts.length === 0 ? (
          <EmptyState
            icon={<FilePen size={20} strokeWidth={1.75} />}
            title="No drafts"
            body="Save a post without a date and it lands here, ready to schedule."
            action={
              <Button size="sm" icon={<Plus size={14} aria-hidden />} onClick={(event) => onNewDraft(event.currentTarget)}>
                New draft
              </Button>
            }
          />
        ) : (
          <ul className={styles.ideaItems} aria-label="Drafts">
            {drafts.map((draft) => {
              const name = authorName(draft.profileId);
              const title = postTitle(draft.contentText);
              return (
                <li key={draft.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    draggable
                    className={styles.ideaCard}
                    aria-label={`${title}, ${name}, ${platformName(draft.platform)}. Open to edit, or drag onto a day.`}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "copyMove";
                      event.dataTransfer.setData(DRAFT_DRAG_TYPE, draft.id);
                      onDragStart(draft);
                    }}
                    onDragEnd={onDragEnd}
                    onClick={(event) => onOpen(draft, event.currentTarget)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onOpen(draft, event.currentTarget);
                      }
                    }}
                  >
                    <GripVertical size={14} className={styles.ideaGrip} aria-hidden />
                    <span className={styles.ideaBody}>
                      <span className={styles.ideaTitle}>{title}</span>
                      <span className={styles.ideaMeta}>
                        <Avatar name={name} src={authorImage(draft.profileId)} size={16} decorative />
                        {name}
                        <PlatformIcon platform={draft.platform} size={11} />
                      </span>
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
