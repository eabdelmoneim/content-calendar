"use client";

import { Plus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useEffectEvent, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { usePosts } from "@/lib/api";
import type { Post, Profile } from "@/lib/types";
import { useShellPane } from "@/shared/peacock/shell";
import { Button, Skeleton, Tabs, useToast } from "@/shared/peacock/ui";
import { useProfileSelection } from "@/shared/shell/profile-selection";
import { todayKey } from "./calendar-model";
import { PostComposer, type PostComposerTarget } from "./composer/post-composer";
import { LibraryView, type LibraryKind } from "./library-view";
import { Scheduler, type ComposeRequest } from "./scheduler";
import { POSTS_MOBILE_QUERY, useMediaQuery } from "./use-media-query";
import styles from "./posts-page.module.css";

type Tab = "scheduler" | LibraryKind;

const TABS: readonly Tab[] = ["scheduler", "drafts", "upcoming", "published"];

/** `?tab=drafts|upcoming|published`; anything else is the Scheduler. */
function parseTab(value: string | null | undefined): Tab | null {
  return TABS.find((tab) => tab === value) ?? null;
}

const subscribeNever = () => () => undefined;

/**
 * Posts screen (Peacock's PostsPage): Scheduler, Drafts, Upcoming and Posted
 * tabs, plus the Composer sheet. Shows the accounts selected in the top bar.
 */
export function PostsPage(): React.JSX.Element {
  useShellPane();
  const selection = useProfileSelection();
  const postsQuery = usePosts();
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const mobile = useMediaQuery(POSTS_MOBILE_QUERY);
  // The device's calendar day; null on the server so hydration stays stable.
  const today = useSyncExternalStore(subscribeNever, todayKey, () => null);
  const [chosenAnchor, setAnchorDate] = useState<string | null>(null);
  const anchorDate = chosenAnchor ?? today;
  const [composer, setComposer] = useState<{ key: number; target: PostComposerTarget } | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const [now, setNow] = useState<number | null>(null);

  const tabParam = parseTab(searchParams?.get("tab"));
  const [tab, setTabState] = useState<Tab>(tabParam ?? "scheduler");
  const [seenTabParam, setSeenTabParam] = useState(tabParam);
  if (tabParam !== seenTabParam) {
    setSeenTabParam(tabParam);
    if (tabParam) setTabState(tabParam);
  }

  useEffect(() => {
    const update = () => setNow(Date.now());
    const frame = requestAnimationFrame(update);
    const timer = setInterval(update, 60_000);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(timer);
    };
  }, []);

  const allProfiles = useMemo<Profile[]>(() => selection.members.map((member) => member.profile), [selection.members]);
  const selectedProfiles = useMemo(
    () => allProfiles.filter((profile) => selection.selectedProfileIds.includes(profile.id)),
    [allProfiles, selection.selectedProfileIds],
  );
  const posts = useMemo<Post[]>(
    () => (postsQuery.data ?? []).filter((post) => selection.selectedProfileIds.includes(post.profileId)),
    [postsQuery.data, selection.selectedProfileIds],
  );
  const loading = postsQuery.isPending || selection.loading;
  const error = postsQuery.error;
  const noSelection = !selection.loading && selection.selectedProfileIds.length === 0;
  const draftCount = posts.filter((post) => post.status === "draft").length;
  const upcomingCount = posts.filter((post) => post.status === "scheduled").length;
  const singleProfile = selection.selectedProfileIds.length === 1 ? selection.selectedProfileIds[0] : undefined;

  function openComposer(target: PostComposerTarget, opener?: HTMLElement): void {
    openerRef.current = opener ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setComposer({ key: Date.now(), target });
  }

  function closeComposer(): void {
    setComposer(null);
    requestAnimationFrame(() => openerRef.current?.focus());
  }

  function newPost(opener?: HTMLElement, date?: string, time?: string): void {
    openComposer(
      {
        mode: "create",
        ...(singleProfile ? { profileId: singleProfile } : {}),
        ...(date ? { date } : {}),
        ...(time ? { time } : {}),
      },
      opener,
    );
  }

  function handleCompose(request: ComposeRequest, opener?: HTMLElement): void {
    if (request.kind === "edit") openComposer({ mode: "edit", post: request.post }, opener);
    else newPost(opener, request.date, request.time);
  }

  /** Current URL with `changes` applied (null removes a parameter). */
  function hrefWith(changes: Record<string, string | null>): string {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    const query = params.toString();
    return `${pathname ?? "/posts"}${query ? `?${query}` : ""}`;
  }

  function setTab(next: Tab): void {
    setTabState(next);
    if (next === tab) return;
    router.replace(hrefWith({ tab: next === "scheduler" ? null : next }), { scroll: false });
  }

  // ⌘K "New post" and the C shortcut land here as /posts?compose=new; a ⌘K
  // post result lands as /posts?post=<id>. Each opens the composer once and
  // drops its parameters, keeping any ?tab=.
  const composeParam = searchParams?.get("compose");
  const postParam = searchParams?.get("post");
  // Assets › "New post with this image" adds ?asset=<id>.
  const assetParam = searchParams?.get("asset");
  const postsReady = postsQuery.data !== undefined && !selection.loading;
  const openFromUrl = useEffectEvent((): void => {
    let next: PostComposerTarget | null = null;
    if (composeParam === "new") {
      if (selection.loading) return;
      next = {
        mode: "create",
        ...(singleProfile ? { profileId: singleProfile } : {}),
        ...(assetParam ? { assetIds: [assetParam] } : {}),
      };
    } else if (postParam) {
      if (!postsReady) return;
      const found = postsQuery.data?.find((post) => post.id === postParam);
      if (found) next = { mode: "edit", post: found };
      else toast.show({ message: "That post no longer exists.", tone: "danger" });
    } else {
      return;
    }
    // router.replace didn't drop these on this Next version, so a reload kept
    // reopening the post; the History API also updates useSearchParams.
    window.history.replaceState(null, "", hrefWith({ compose: null, post: null, asset: null }));
    if (!next) return;
    const opened = next;
    // Not cancelled on cleanup: dropping the parameters above re-runs this
    // effect, and cancelling there meant the post sometimes never opened.
    requestAnimationFrame(() => {
      openerRef.current = null;
      setComposer({ key: Date.now(), target: opened });
    });
  });
  useEffect(() => openFromUrl(), [composeParam, postParam, postsReady, selection.loading]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Tabs<Tab>
          label="Posts views"
          className={styles.tabs}
          value={tab}
          onChange={setTab}
          items={[
            { value: "scheduler", label: "Scheduler" },
            {
              value: "drafts",
              label: (
                <span className={styles.tabLabel}>
                  Drafts
                  {!loading ? <span className={styles.tabCount}>{draftCount}</span> : null}
                </span>
              ),
            },
            {
              value: "upcoming",
              label: (
                <span className={styles.tabLabel}>
                  Upcoming
                  {!loading ? <span className={styles.tabCount}>{upcomingCount}</span> : null}
                </span>
              ),
            },
            { value: "published", label: "Posted" },
          ]}
        />
        {mobile && tab === "scheduler" ? null : (
          <Button
            variant="primary"
            className={styles.newPost}
            icon={<Plus size={15} aria-hidden />}
            disabled={noSelection}
            aria-keyshortcuts="C"
            onClick={(event) => newPost(event.currentTarget)}
          >
            New post
            <kbd className={styles.newPostKey} aria-hidden>
              C
            </kbd>
          </Button>
        )}
      </div>

      {tab === "scheduler" ? (
        anchorDate ? (
          <Scheduler
            posts={posts}
            loading={loading}
            error={error}
            onRetry={() => void postsQuery.refetch()}
            profiles={allProfiles}
            noSelection={noSelection}
            anchorDate={anchorDate}
            onAnchorDateChange={setAnchorDate}
            onCompose={handleCompose}
          />
        ) : (
          <div className={styles.booting} aria-busy>
            <Skeleton height={28} width={320} radius="md" />
            <Skeleton height={480} radius="lg" />
          </div>
        )
      ) : (
        <LibraryView
          key={tab}
          kind={tab}
          posts={posts}
          profiles={allProfiles}
          loading={loading}
          error={error}
          onRetry={() => void postsQuery.refetch()}
          now={now}
          onOpen={(post) => openComposer({ mode: "edit", post })}
          onNewPost={(opener) => newPost(opener)}
          onOpenScheduler={() => setTab("scheduler")}
        />
      )}

      {composer ? (
        <PostComposer
          key={composer.key}
          target={composer.target}
          posts={postsQuery.data ?? []}
          profiles={allProfiles}
          createProfiles={selectedProfiles}
          onClose={closeComposer}
          onClosedWithMessage={(message) => {
            closeComposer();
            toast.show({ message, tone: "success" });
          }}
          onNavigateToDate={(date) => {
            setAnchorDate(date);
            setTab("scheduler");
            closeComposer();
          }}
        />
      ) : null}
    </div>
  );
}
