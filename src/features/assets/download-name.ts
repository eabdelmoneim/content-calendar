/**
 * Builds the `Content-Disposition: attachment` header for `?download=1` on the
 * asset file route. The stored name is user-supplied (and renamable), so it is
 * stripped of control characters, quotes and path separators, bounded, and
 * given the extension of the bytes actually served. Non-ASCII names go in
 * `filename*`; a raw non-Latin-1 header value would make the Response throw.
 */

const EXTENSION_BY_TYPE: Readonly<Record<string, string>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

const MATCHING_EXTENSIONS: Readonly<Record<string, readonly string[]>> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/gif": ["gif"],
  "image/webp": ["webp"],
  "video/mp4": ["mp4", "m4v"],
  "video/quicktime": ["mov"],
  "video/webm": ["webm"],
};

const MAX_BASE_LENGTH = 120;
const FALLBACK_BASE = "asset";

/** A safe display file name with an extension that matches `contentType`. */
export function sanitizeDownloadFileName(
  rawName: string,
  contentType: string,
): string {
  const cleaned = rawName
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f-\u009f]/gu, "")
    .replace(/["\\/:*?<>|;]/gu, "_")
    .replace(/\s+/gu, " ")
    .trim()
    .replace(/^\.+/u, "");
  const dot = cleaned.lastIndexOf(".");
  const extension = dot > 0 ? cleaned.slice(dot + 1).toLowerCase() : "";
  const allowed = MATCHING_EXTENSIONS[contentType] ?? [];
  const keepExtension = allowed.includes(extension);
  let base = (dot > 0 ? cleaned.slice(0, dot) : cleaned).trim();
  base = Array.from(base).slice(0, MAX_BASE_LENGTH).join("").trim();
  if (base.length === 0) base = FALLBACK_BASE;
  const finalExtension = keepExtension
    ? extension
    : (EXTENSION_BY_TYPE[contentType] ?? "");
  return finalExtension ? `${base}.${finalExtension}` : base;
}

/** RFC 5987 value for `filename*`. */
function encodeRfc5987(value: string): string {
  return encodeURIComponent(value).replace(
    /['()*]/gu,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/** `attachment; filename="<ascii>"; filename*=UTF-8''<utf8>` for a stored file name. */
export function attachmentContentDisposition(rawName: string, contentType: string): string {
  const name = sanitizeDownloadFileName(rawName, contentType);
  const ascii = name.replace(/[^\x20-\x7e]/gu, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeRfc5987(name)}`;
}
