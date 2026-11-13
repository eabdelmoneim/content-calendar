/**
 * Links to large media kept outside the app (a YouTube video, a Google Drive
 * file or folder). Shared by the API routes and the browser so both accept the
 * same links.
 */
import { assertNever } from "./assert";

export const MAX_MEDIA_LINKS = 5;

export const MEDIA_LINK_KINDS = ["youtube", "google_drive"] as const;
export type MediaLinkKind = (typeof MEDIA_LINK_KINDS)[number];

export type ParsedMediaLink =
  | { ok: true; url: string; kind: MediaLinkKind }
  | { ok: false; message: string };

function kindOfHost(host: string): MediaLinkKind | null {
  const bare = host.toLowerCase().replace(/^(www|m)\./, "");
  if (bare === "youtube.com" || bare === "youtu.be" || bare === "music.youtube.com") return "youtube";
  if (bare === "drive.google.com" || bare === "docs.google.com") return "google_drive";
  return null;
}

/** Accepts a pasted YouTube or Google Drive link; anything else gets a reason. */
export function parseMediaLink(raw: string): ParsedMediaLink {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { ok: false, message: "Paste a YouTube or Google Drive link." };
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return { ok: false, message: "That isn't a link. Paste the full YouTube or Google Drive link." };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, message: "That isn't a web link. Paste the full YouTube or Google Drive link." };
  }
  const kind = kindOfHost(url.hostname);
  if (!kind) return { ok: false, message: "Only YouTube and Google Drive links can be added." };
  url.protocol = "https:";
  return { ok: true, url: url.toString(), kind };
}

/** Kind of a link already stored on a post (stored links always parse). */
export function mediaLinkKind(url: string): MediaLinkKind {
  const parsed = parseMediaLink(url);
  if (!parsed.ok) throw new Error(`Stored media link is not YouTube or Google Drive: ${url}`);
  return parsed.kind;
}

export function mediaLinkLabel(kind: MediaLinkKind): string {
  switch (kind) {
    case "youtube":
      return "YouTube";
    case "google_drive":
      return "Google Drive";
    default:
      return assertNever(kind);
  }
}
