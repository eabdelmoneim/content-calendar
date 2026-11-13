import { assertNever } from "./assert";
import type { Platform } from "./types";

/**
 * The posting method Reply Desk uses: a share link that opens the platform's
 * own composer with the text filled in. The person reviews it there and
 * presses Post themselves, signed in as the account they post from. Nothing
 * is ever published by this app.
 */
export function shareLink(platform: Platform, text: string): string {
  switch (platform) {
    case "x":
      return `https://x.com/intent/post?text=${encodeURIComponent(text)}`;
    case "linkedin":
      return `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}`;
    default:
      return assertNever(platform);
  }
}

export function platformLabel(platform: Platform): string {
  switch (platform) {
    case "x":
      return "X";
    case "linkedin":
      return "LinkedIn";
    default:
      return assertNever(platform);
  }
}
