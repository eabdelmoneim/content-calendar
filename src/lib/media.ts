/**
 * What the Assets library accepts and how media combines on a post. Shared by
 * the API routes and the browser so both enforce the same rules.
 */
import type { Platform } from "./types";

const IMAGE_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
} as const;

const VIDEO_EXTENSIONS = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
} as const;

export type ImageMime = keyof typeof IMAGE_EXTENSIONS;
export type VideoMime = keyof typeof VIDEO_EXTENSIONS;
export type MediaKind = "image" | "video";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
/**
 * Videos go straight from the browser to Supabase Storage, so this is bounded
 * only by the cc-assets bucket limit and the project's global upload cap.
 */
export const MAX_VIDEO_BYTES = 300 * 1024 * 1024;

export const MEDIA_ACCEPT_ATTRIBUTE = [
  ".jpg,.jpeg,.png,.gif,.webp,.mp4,.mov,.webm",
  ...Object.keys(IMAGE_EXTENSIONS),
  ...Object.keys(VIDEO_EXTENSIONS),
].join(",");
export const ACCEPTED_MEDIA_COPY = "JPG, PNG, GIF or WebP up to 10 MB · MP4, MOV or WebM video up to 300 MB";

function isImageMime(mime: string): mime is ImageMime {
  return Object.prototype.hasOwnProperty.call(IMAGE_EXTENSIONS, mime);
}

function isVideoMime(mime: string): mime is VideoMime {
  return Object.prototype.hasOwnProperty.call(VIDEO_EXTENSIONS, mime);
}

/** null for a type the library doesn't take. */
export function mediaKind(mime: string): MediaKind | null {
  if (isImageMime(mime)) return "image";
  if (isVideoMime(mime)) return "video";
  return null;
}

export function mediaExtension(mime: string): string | null {
  if (isImageMime(mime)) return IMAGE_EXTENSIONS[mime];
  if (isVideoMime(mime)) return VIDEO_EXTENSIONS[mime];
  return null;
}

/** Why a file can't go in the library, or null when it can. */
export function mediaProblem(file: { name: string; type: string; size: number }): string | null {
  const kind = mediaKind(file.type);
  if (kind === null) return `${file.name} isn't a JPG, PNG, GIF or WebP image, or an MP4, MOV or WebM video.`;
  if (file.size === 0) return `${file.name} is empty.`;
  switch (kind) {
    case "image":
      return file.size > MAX_IMAGE_BYTES ? `${file.name} is over 10 MB. Images must be 10 MB or smaller.` : null;
    case "video":
      return file.size > MAX_VIDEO_BYTES ? `${file.name} is over 300 MB. Videos must be 300 MB or smaller.` : null;
  }
}

export const X_IMAGE_LIMIT = 4;
export const LINKEDIN_IMAGE_LIMIT = 20;

/**
 * X and LinkedIn both take either images or a single video per post, never a
 * mix. Returns why the attachments can't post together, or null.
 */
export function postMediaProblem(platform: Platform, mimeTypes: readonly string[]): string | null {
  const videos = mimeTypes.filter((mime) => mediaKind(mime) === "video").length;
  const network = platform === "x" ? "X" : "LinkedIn";
  if (videos > 0 && mimeTypes.length > 1) {
    return `${network} posts take one video on its own, or images only. Remove the extra ${videos > 1 ? "video" : "image"}.`;
  }
  const limit = platform === "x" ? X_IMAGE_LIMIT : LINKEDIN_IMAGE_LIMIT;
  if (mimeTypes.length > limit) {
    return `${network} allows up to ${limit} images. Remove ${mimeTypes.length - limit}.`;
  }
  return null;
}
