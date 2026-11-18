/** Shared shapes between the API routes and the client. */

export const PLATFORMS = ["linkedin", "x"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const POST_STATUSES = ["draft", "scheduled", "published"] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export const METRIC_SOURCES = ["manual", "csv", "x_api", "linkedin_api"] as const;
export type MetricSource = (typeof METRIC_SOURCES)[number];

export const MAX_POST_IMAGES = 20;

export type Session = {
  user: { id: string; name: string; avatarUrl: string | null };
  workspace: { id: string; name: string; iconUrl: string | null };
};

export type Profile = {
  id: string;
  name: string;
  kind: "person" | "company";
  avatarUrl: string | null;
  linkedinUrl: string | null;
  xHandle: string | null;
  sortOrder: number;
};

export type PostMetrics = {
  capturedAt: string;
  impressions: number | null;
  reactions: number | null;
  comments: number | null;
  reposts: number | null;
  clicks: number | null;
  source: MetricSource;
};

export type Post = {
  id: string;
  profileId: string;
  platform: Platform;
  status: PostStatus;
  contentHtml: string;
  contentText: string;
  scheduledAt: string | null;
  approvedAt: string | null;
  approvedByName: string | null;
  publishedAt: string | null;
  publishedUrl: string | null;
  createdByName: string | null;
  updatedByName: string | null;
  createdAt: string;
  updatedAt: string;
  assetIds: string[];
  /** YouTube / Google Drive links for media too large to upload. */
  mediaLinks: string[];
  metrics: PostMetrics | null;
};

export type Asset = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  createdByName: string | null;
  createdAt: string;
  /** Same-origin URL that streams the image. */
  url: string;
  usedInPostIds: string[];
};

/** A planned asset on the To-Do list. */
export type AssetTodo = {
  id: string;
  title: string;
  /** Calendar day (YYYY-MM-DD) it should be finished by. */
  dueOn: string | null;
  /** Who is on the hook for it, in display order; empty when unassigned. */
  assigneeNames: string[];
  /** Files attached to it, in order: ids of Assets library items. */
  assetIds: string[];
  /** When someone marked it in progress (null when not started). Stays set once done. */
  startedAt: string | null;
  startedByName: string | null;
  completedAt: string | null;
  completedByName: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
};

export const MAX_TODO_TITLE = 500;
export const MAX_ASSIGNEE_NAME = 120;
/** People one to-do can be on at once. */
export const MAX_ASSIGNEES = 6;
export const MAX_TODO_ATTACHMENTS = 10;

export type FollowerSnapshot = {
  profileId: string;
  platform: Platform;
  capturedOn: string;
  followers: number;
};

export type PostInput = {
  profileId: string;
  platform: Platform;
  contentHtml: string;
  contentText: string;
  /** null keeps it a draft. */
  scheduledAt: string | null;
  assetIds: string[];
  /** YouTube / Google Drive links. Left out on an update keeps the post's current links. */
  mediaLinks?: string[];
};

export type ApiError = { error: { code: string; message: string } };
