/**
 * The composer's "Publishing" panel (Peacock's publish-copy.ts idea): one
 * StatusChip, a one-line title, the reason, and the next step. Pure so the
 * wording can be checked in one place.
 *
 * Content Calendar never posts by itself. Every step here is a person's
 * click: approve, open the platform's composer, press Post there, then come
 * back and mark it as posted.
 */
import type { ChipStatus } from "@/shared/peacock/ui";
import { assertNever } from "@/lib/assert";
import type { Platform, Post } from "@/lib/types";
import { clock, whenLabel } from "./calendar-model";
import { platformName } from "./platform-icon";

export type PublishStep = "approve" | "post" | "live";

export type PublishPanel = {
  step: PublishStep;
  chip: ChipStatus;
  chipLabel: string;
  tone: "neutral" | "review" | "warning" | "success";
  title: string;
  body: string;
};

export const NEVER_POSTS = "Content Calendar never posts by itself.";

const DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

function possessive(name: string): string {
  return name.endsWith("s") ? `${name}'` : `${name}'s`;
}

/** Who to be signed in as: "@handle" on X, the account name on LinkedIn. */
export function accountPhrase(platform: Platform, authorName: string, xHandle: string | null): string {
  switch (platform) {
    case "x":
      return xHandle ? `@${xHandle}` : `${possessive(authorName)} X account`;
    case "linkedin":
      return authorName;
    default:
      return assertNever(platform);
  }
}

export function publishPanel(input: {
  post: Post;
  nowMs: number;
  authorName: string;
  xHandle: string | null;
}): PublishPanel {
  const { post, nowMs, authorName, xHandle } = input;
  const platform = platformName(post.platform);
  const account = accountPhrase(post.platform, authorName, xHandle);
  if (post.status === "published") {
    return {
      step: "live",
      chip: "published",
      chipLabel: "Posted",
      tone: "success",
      title: post.publishedAt ? `Marked as posted ${DATE.format(new Date(post.publishedAt))}` : "Marked as posted",
      body: post.publishedUrl
        ? `Live on ${platform} (${account}). Editing is locked here; changes on ${platform} are made there.`
        : `Add the link to the live post so the team can find it and record its numbers.`,
    };
  }
  if (!post.approvedAt) {
    return {
      step: "approve",
      chip: "in_review",
      chipLabel: "Needs approval",
      tone: "review",
      title: "Waiting for approval",
      body: `Someone approves this exact post before it goes out. Any edit to the text, images or account asks for approval again. ${NEVER_POSTS}`,
    };
  }
  const due = post.scheduledAt !== null && Date.parse(post.scheduledAt) <= nowMs;
  const when = post.scheduledAt ? whenLabel(clock(post.scheduledAt).date, clock(post.scheduledAt).time) : null;
  if (due) {
    return {
      step: "post",
      chip: "deferred",
      chipLabel: "Due · not posted",
      tone: "warning",
      title: `Was due ${when} · not marked posted`,
      body: `Post it on ${platform} now, signed in as ${account}, then mark it as posted. ${NEVER_POSTS}`,
    };
  }
  return {
    step: "post",
    chip: "scheduled",
    chipLabel: "Approved",
    tone: "neutral",
    title: when ? `Ready for ${when}` : "Approved · no date yet",
    body: `At posting time, open ${platform} signed in as ${account}, press Post there, then mark it as posted here. ${NEVER_POSTS}`,
  };
}
