import { ACCEPTED_MEDIA_COPY, MEDIA_ACCEPT_ATTRIBUTE, mediaProblem } from "@/lib/media";
import { MISSING } from "@/shared/peacock/format";
import type { ChipStatus } from "@/shared/peacock/ui";
import type { Asset, Post, PostStatus } from "@/lib/types";

/** Toolbar filter values. */
export type AssetUsageFilter = "all" | "used" | "unused";

/** Toolbar sort values. */
export type AssetSort = "newest" | "oldest" | "name" | "largest";

/** What the library accepts (the server enforces the same rules). */
export const IMAGE_ACCEPT_ATTRIBUTE = MEDIA_ACCEPT_ATTRIBUTE;
export const ACCEPTED_COPY = ACCEPTED_MEDIA_COPY;

/** Why a file can't be uploaded, or null when it can. */
export function fileProblem(file: File): string | null {
  return mediaProblem(file);
}

/** "Used in 1 post", "Used in 3 posts" or "Unused". */
export function usageLabel(referenceCount: number): string {
  if (referenceCount <= 0) return "Unused";
  return `Used in ${referenceCount} ${referenceCount === 1 ? "post" : "posts"}`;
}

/** Chip for a post that uses the image. */
export function usageChip(status: PostStatus): { status: ChipStatus; label?: string } {
  switch (status) {
    case "draft":
      return { status: "draft_saved", label: "Draft" };
    case "scheduled":
      return { status: "scheduled" };
    case "published":
      return { status: "published" };
  }
}

/** Mirrors `archiveAsset` on the server: drafts and scheduled posts block Delete. */
export function blockingPosts(posts: readonly Post[]): Post[] {
  return posts.filter((post) => post.status !== "published");
}

export function inUseCopy(count: number): string {
  return `Attached to ${count} unpublished post${count === 1 ? "" : "s"}. Remove it there before deleting. Published posts keep their copy.`;
}

/** Binary units, matching the 10 MB / 300 MB (MiB) upload limits. */
export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return MISSING;
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb >= 100 ? Math.round(mb) : mb.toFixed(1)} MB`;
}

export function formatDimensions(width: number | null, height: number | null): string {
  if (width === null || height === null) return MISSING;
  return `${width} × ${height}`;
}

/** "Oct 20", or "Oct 20, 2025" outside the current year. */
export function formatUploadedDate(iso: string, now = Date.now()): string {
  const date = new Date(iso);
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/** "Neel · Oct 20"; the date alone when the uploader is unknown. */
export function uploadedLabel(uploaderName: string | null, createdAt: string, now = Date.now()): string {
  const date = formatUploadedDate(createdAt, now);
  return uploaderName ? `${uploaderName} · ${date}` : date;
}

/** Toolbar count: "9 images · 13.9 MB", with uploads in flight appended. */
export function libraryCountLabel(input: { count: number; totalBytes: number; uploading: number }): string {
  if (input.count === 0 && input.uploading === 0) return "";
  const count = `${input.count} ${input.count === 1 ? "file" : "files"}`;
  const tail = input.uploading > 0 ? `${input.uploading} uploading` : formatFileSize(input.totalBytes);
  return `${count} · ${tail}`;
}

/** Search, usage filter and sort, applied client-side. */
export function visibleAssets(
  assets: readonly Asset[],
  options: { search: string; usage: AssetUsageFilter; sort: AssetSort },
): Asset[] {
  const needle = options.search.trim().toLowerCase();
  const filtered = assets.filter((asset) => {
    if (needle && !asset.fileName.toLowerCase().includes(needle)) return false;
    if (options.usage === "used") return asset.usedInPostIds.length > 0;
    if (options.usage === "unused") return asset.usedInPostIds.length === 0;
    return true;
  });
  const byDate = (a: Asset, b: Asset) => a.createdAt.localeCompare(b.createdAt);
  switch (options.sort) {
    case "newest":
      return filtered.sort((a, b) => byDate(b, a));
    case "oldest":
      return filtered.sort(byDate);
    case "name":
      return filtered.sort((a, b) => a.fileName.localeCompare(b.fileName, "en", { sensitivity: "base" }));
    case "largest":
      return filtered.sort((a, b) => b.sizeBytes - a.sizeBytes);
  }
}

/** The Posts screen's composer, pre-attaching this image. */
export function newPostHref(assetId: string): string {
  return `/posts?compose=new&asset=${encodeURIComponent(assetId)}`;
}

/** Deep link that opens an asset's detail on the Assets screen. */
export function assetHref(assetId: string): string {
  return `/assets?asset=${encodeURIComponent(assetId)}`;
}

export function assetDownloadUrl(asset: Pick<Asset, "url">): string {
  return `${asset.url}?download=1`;
}
