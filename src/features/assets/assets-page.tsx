"use client";

import { AssetMedia } from "./asset-media";
import { CircleDashed, FileText, Images, SearchX, Upload, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type DragEvent,
} from "react";

import { useArchiveAsset, useAssets, usePosts, useProfiles } from "@/lib/api";
import type { Asset } from "@/lib/types";
import { useShellPane } from "@/shared/peacock/shell/shell-title";
import {
  Button,
  cx,
  Dialog,
  EmptyState,
  ICON_STROKE,
  IconButton,
  InlineAlert,
  Input,
  Segmented,
  Select,
  Sheet,
  Skeleton,
  StatusChip,
  useToast,
} from "@/shared/peacock/ui";

import { useAssetCommandSource } from "./asset-command-source";
import { AssetDetailBody } from "./asset-detail";
import {
  ACCEPTED_COPY,
  IMAGE_ACCEPT_ATTRIBUTE,
  libraryCountLabel,
  usageLabel,
  visibleAssets,
  type AssetSort,
  type AssetUsageFilter,
} from "./asset-presentation";
import { AssetsUnavailable } from "./assets-unavailable";
import { useAssetUploads, type UploadEntry } from "./use-asset-uploads";
import styles from "./assets.module.css";

const SKELETON_TILES = 10;
const SEARCH_DEBOUNCE_MS = 200;
const MOBILE_QUERY = "(max-width: 767px)";
const ICON = { size: 15, strokeWidth: ICON_STROKE } as const;

const USAGE_OPTIONS: { value: AssetUsageFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "used", label: "In use" },
  { value: "unused", label: "Unused" },
];

const SORT_OPTIONS: { value: AssetSort; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name", label: "Name A–Z" },
  { value: "largest", label: "Largest first" },
];

function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (listener: () => void) => {
      if (typeof window.matchMedia !== "function") return () => {};
      const list = window.matchMedia(query);
      list.addEventListener("change", listener);
      return () => list.removeEventListener("change", listener);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => typeof window.matchMedia === "function" && window.matchMedia(query).matches,
    () => false,
  );
}

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function hasFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}

function modalIsOpen(): boolean {
  return document.querySelector('dialog[open], [aria-modal="true"]') !== null;
}

/**
 * Peacock Assets screen (SCREENS.md › 7 Assets). The library is shared by the
 * whole workspace (images aren't owned by an account), so it does not follow
 * the top-bar account selector; each image's "Used in" list names the account.
 */
export function AssetsPage(): React.JSX.Element {
  useShellPane();
  useAssetCommandSource();
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const mobile = useMediaQuery(MOBILE_QUERY);

  const assetsQuery = useAssets();
  const postsQuery = usePosts();
  const profilesQuery = useProfiles();

  const [searchInput, setSearchInput] = useState("");
  const search = useDebounced(searchInput.trim(), SEARCH_DEBOUNCE_MS);
  const [usage, setUsage] = useState<AssetUsageFilter>("all");
  const [sort, setSort] = useState<AssetSort>("newest");
  const allAssets = useMemo(() => assetsQuery.data ?? [], [assetsQuery.data]);
  const assets = useMemo(
    () => visibleAssets(allAssets, { search, usage, sort }),
    [allAssets, search, usage, sort],
  );

  // Selection: `?asset=` deep links (⌘K) open the detail directly.
  const deepLinkedAsset = searchParams?.get("asset") ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(deepLinkedAsset);
  const [handledDeepLink, setHandledDeepLink] = useState(deepLinkedAsset);
  if (deepLinkedAsset !== handledDeepLink) {
    setHandledDeepLink(deepLinkedAsset);
    if (deepLinkedAsset) setSelectedId(deepLinkedAsset);
  }
  const detail = selectedId ? allAssets.find((asset) => asset.id === selectedId) : undefined;
  const detailOpen = detail !== undefined;
  const detailId = useId();
  const detailTitleRef = useRef<HTMLHeadingElement>(null);
  const focusDetailOnOpen = useRef(false);

  const clearDeepLink = useCallback(() => {
    if (searchParams?.get("asset")) router.replace("/assets", { scroll: false });
  }, [router, searchParams]);

  const closeDetail = useCallback(() => {
    const previous = selectedId;
    setSelectedId(null);
    clearDeepLink();
    if (previous) {
      requestAnimationFrame(() => {
        document.querySelector<HTMLElement>(`[data-asset-tile="${previous}"]`)?.focus();
      });
    }
  }, [clearDeepLink, selectedId]);

  function openDetail(asset: Asset): void {
    focusDetailOnOpen.current = true;
    setSelectedId(asset.id);
  }

  useEffect(() => {
    if (!detailOpen || mobile || !focusDetailOnOpen.current) return;
    focusDetailOnOpen.current = false;
    detailTitleRef.current?.focus();
  }, [detailOpen, mobile, selectedId]);

  // Esc closes the desktop side panel (the mobile sheet handles its own).
  useEffect(() => {
    if (!detailOpen || mobile) return;
    function onKey(event: KeyboardEvent): void {
      if (event.key !== "Escape" || event.defaultPrevented || modalIsOpen()) return;
      closeDetail();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [closeDetail, detailOpen, mobile]);

  const { uploads, batchError, start, dismiss, clearBatchError } = useAssetUploads();
  const inputRef = useRef<HTMLInputElement>(null);
  const openPicker = () => inputRef.current?.click();

  function onFilesChosen(event: ChangeEvent<HTMLInputElement>): void {
    void start(Array.from(event.target.files ?? []));
    event.target.value = "";
  }

  // Full-screen drop target. A depth counter keeps the overlay steady while
  // the pointer crosses child elements.
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const dropHandlers = {
    onDragEnter: (event: DragEvent<HTMLDivElement>) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      dragDepth.current += 1;
      setDragging(true);
    },
    onDragOver: (event: DragEvent<HTMLDivElement>) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    },
    onDragLeave: (event: DragEvent<HTMLDivElement>) => {
      if (!hasFiles(event)) return;
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragging(false);
    },
    onDrop: (event: DragEvent<HTMLDivElement>) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      void start(Array.from(event.dataTransfer.files));
    },
  };

  // Delete confirmation. The server refuses while an unpublished post uses it.
  const archive = useArchiveAsset();
  const [deleteTarget, setDeleteTarget] = useState<Asset | null>(null);

  function confirmDelete(): void {
    if (!deleteTarget) return;
    const target = deleteTarget;
    archive.mutate(target.id, {
      onSuccess: () => {
        setDeleteTarget(null);
        setSelectedId(null);
        clearDeepLink();
        toast.show({ message: `${target.fileName} deleted.` });
      },
    });
  }

  const firstLoad = assetsQuery.isPending;
  const filtered = search.length > 0 || usage !== "all";
  const inFlight = uploads.filter((entry) => entry.phase !== "failed").length;
  const countLabel = firstLoad
    ? ""
    : libraryCountLabel({
        count: allAssets.length,
        totalBytes: allAssets.reduce((sum, asset) => sum + asset.sizeBytes, 0),
        uploading: inFlight,
      });

  const detailBody = detail ? (
    <AssetDetailBody
      asset={detail}
      posts={postsQuery.data}
      profiles={profilesQuery.data ?? []}
      onRequestDelete={() => {
        archive.reset();
        setDeleteTarget(detail);
      }}
    />
  ) : (
    <div className={styles.detailBody} aria-busy="true">
      <Skeleton height={216} radius="lg" />
      <Skeleton height={14} width="70%" />
      <Skeleton height={14} width="50%" />
    </div>
  );

  return (
    <div className={styles.screen}>
      <div className={styles.main} {...dropHandlers}>
        <div className={styles.toolbar}>
          <Input
            type="search"
            aria-label="Search assets"
            placeholder="Search assets"
            fieldClassName={styles.search}
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <Segmented label="Show assets" size="compact" options={USAGE_OPTIONS} value={usage} onChange={setUsage} />
          <Select
            aria-label="Sort assets"
            fieldClassName={styles.sort}
            options={SORT_OPTIONS}
            value={sort}
            onChange={(event) => setSort(event.target.value as AssetSort)}
          />
          <span className={styles.spacer} />
          {countLabel ? (
            <span className={styles.count} aria-live="polite">
              {countLabel}
            </span>
          ) : null}
          <Button variant="primary" className={styles.uploadButton} icon={<Upload {...ICON} />} onClick={openPicker}>
            Upload
          </Button>
          <input
            ref={inputRef}
            className="sr-only"
            type="file"
            multiple
            accept={IMAGE_ACCEPT_ATTRIBUTE}
            tabIndex={-1}
            aria-hidden
            onChange={onFilesChosen}
          />
        </div>

        {batchError ? (
          <div className={styles.alertRow}>
            <InlineAlert
              tone="danger"
              action={<IconButton aria-label="Dismiss" size="sm" icon={<X {...ICON} />} onClick={clearBatchError} />}
            >
              {batchError}
            </InlineAlert>
          </div>
        ) : null}

        <div className={styles.scroll}>
          {firstLoad ? (
            <div className={styles.grid} aria-busy="true" aria-label="Loading assets">
              {Array.from({ length: SKELETON_TILES }, (_, index) => (
                <div key={index} className={styles.tileSkeleton}>
                  <Skeleton height="auto" radius="lg" className={styles.thumbSkeleton} />
                  <Skeleton height={14} width="70%" />
                  <Skeleton height={12} width="40%" />
                </div>
              ))}
            </div>
          ) : assetsQuery.isError ? (
            <AssetsUnavailable
              message={assetsQuery.error.message}
              retrying={assetsQuery.isFetching}
              onRetry={() => void assetsQuery.refetch()}
            />
          ) : assets.length === 0 && uploads.length === 0 ? (
            filtered ? (
              <EmptyState
                icon={<SearchX />}
                title="No assets match"
                body={
                  search
                    ? "Nothing in the library matches your search and filter."
                    : usage === "used"
                      ? "None of these assets is attached to a post yet."
                      : "Every asset in the library is attached to a post."
                }
                action={
                  <Button
                    onClick={() => {
                      setSearchInput("");
                      setUsage("all");
                    }}
                  >
                    Show all images
                  </Button>
                }
              />
            ) : (
              <div className={styles.emptyDrop}>
                <EmptyState
                  icon={<Images />}
                  headingLevel={2}
                  title="Your asset library is empty"
                  body="Drop images or videos here or upload them. JPG, PNG, GIF or WebP up to 10 MB; MP4, MOV or WebM up to 300 MB. Files you add to posts land here too."
                  action={
                    <Button icon={<Upload {...ICON} />} onClick={openPicker}>
                      Upload images
                    </Button>
                  }
                />
              </div>
            )
          ) : (
            <ul className={styles.grid} aria-label="Assets">
              {uploads.map((entry) => (
                <li key={entry.id}>
                  <UploadTile entry={entry} onDismiss={dismiss} />
                </li>
              ))}
              {assets.map((asset) => (
                <li key={asset.id}>
                  <AssetTile
                    asset={asset}
                    selected={asset.id === selectedId && detailOpen}
                    controls={detailId}
                    onOpen={() => openDetail(asset)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        {dragging ? (
          <div className={styles.dropOverlay} aria-hidden>
            <div className={styles.dropMessage}>
              <Upload size={28} strokeWidth={ICON_STROKE} />
              <span className={styles.dropTitle}>Drop to upload</span>
              <span className={styles.dropBody}>{ACCEPTED_COPY}</span>
            </div>
          </div>
        ) : null}
      </div>

      {detailOpen && !mobile ? (
        <aside id={detailId} className={styles.detail} aria-labelledby={`${detailId}-title`}>
          <header className={styles.detailHeader}>
            <h2 id={`${detailId}-title`} ref={detailTitleRef} tabIndex={-1} className={styles.detailTitle}>
              {detail?.fileName ?? "Asset"}
            </h2>
            <IconButton aria-label="Close" size="sm" icon={<X {...ICON} />} onClick={closeDetail} />
          </header>
          {detailBody}
        </aside>
      ) : null}

      <Sheet
        open={detailOpen && mobile}
        onOpenChange={(open) => {
          if (!open) closeDetail();
        }}
        side="bottom"
        title={detail?.fileName ?? "Asset"}
      >
        {detailBody}
      </Sheet>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !archive.isPending) setDeleteTarget(null);
        }}
        title={`Delete ${deleteTarget?.fileName ?? "this file"}?`}
        description="It leaves the asset library. Published posts that used it keep their copy."
        actions={
          <>
            <Button disabled={archive.isPending} onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={archive.isPending} loadingLabel="Deleting…" onClick={confirmDelete}>
              Delete
            </Button>
          </>
        }
      >
        {archive.isError ? <InlineAlert tone="danger">{archive.error.message}</InlineAlert> : null}
      </Dialog>
    </div>
  );
}

function AssetTile({
  asset,
  selected,
  controls,
  onOpen,
}: {
  asset: Asset;
  selected: boolean;
  controls: string;
  onOpen: () => void;
}): React.JSX.Element {
  const count = asset.usedInPostIds.length;
  return (
    <button
      type="button"
      className={cx(styles.tile, selected && styles.tileSelected)}
      data-asset-tile={asset.id}
      aria-label={`${asset.fileName}, ${usageLabel(count)}`}
      aria-expanded={selected}
      aria-controls={selected ? controls : undefined}
      onClick={onOpen}
    >
      <span className={styles.thumb}>
        <AssetMedia src={asset.url} mimeType={asset.mimeType} lazy />
      </span>
      <span className={styles.tileText}>
        <span className={styles.tileName}>{asset.fileName}</span>
        <span className={styles.tileMeta}>
          {count > 0 ? (
            <FileText size={12} strokeWidth={ICON_STROKE} aria-hidden />
          ) : (
            <CircleDashed size={12} strokeWidth={ICON_STROKE} aria-hidden />
          )}
          {usageLabel(count)}
        </span>
      </span>
    </button>
  );
}

function UploadTile({ entry, onDismiss }: { entry: UploadEntry; onDismiss: (id: string) => void }): React.JSX.Element {
  const failed = entry.phase === "failed";
  return (
    <div className={styles.tile} data-upload={entry.phase}>
      <span className={cx(styles.thumb, styles.thumbPending)}>
        {failed ? (
          <StatusChip status="failed" label="Upload failed" />
        ) : (
          <span className={styles.uploadProgress}>
            <StatusChip status="processing" label={entry.progress >= 100 ? "Saving…" : "Uploading…"} />
            <span
              className={styles.progressTrack}
              role="progressbar"
              aria-label={`${entry.name} upload progress`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={entry.progress}
            >
              <span className={styles.progressFill} style={{ width: `${entry.progress}%` }} />
            </span>
          </span>
        )}
        {failed ? (
          <IconButton
            aria-label={`Dismiss ${entry.name}`}
            size="sm"
            className={styles.dismiss}
            icon={<X {...ICON} />}
            onClick={() => onDismiss(entry.id)}
          />
        ) : null}
      </span>
      <span className={styles.tileText}>
        <span className={styles.tileName}>{entry.name}</span>
        <span className={cx(styles.tileMeta, failed && styles.tileMetaError)} role={failed ? "alert" : undefined}>
          {failed ? (
            (entry.error ?? "Upload failed")
          ) : (
            <>
              <Upload size={12} strokeWidth={ICON_STROKE} aria-hidden />
              Uploading {entry.progress}%
            </>
          )}
        </span>
      </span>
    </div>
  );
}
