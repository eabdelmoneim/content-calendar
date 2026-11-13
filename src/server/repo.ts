import "server-only";

import { assertNever } from "@/lib/assert";
import {
  MAX_POST_IMAGES,
  PLATFORMS,
  type Asset,
  type FollowerSnapshot,
  type MetricSource,
  type Platform,
  type Post,
  type PostInput,
  type PostMetrics,
  type PostStatus,
  type Profile,
} from "@/lib/types";
import { postMediaProblem } from "@/lib/media";
import { MAX_MEDIA_LINKS, parseMediaLink } from "@/lib/media-links";

import { db } from "./db";
import { fail, must } from "./http";

/* ------------------------------------------------------------------ rows */

type ProfileRow = {
  id: string;
  name: string;
  kind: "person" | "company";
  avatar_url: string | null;
  linkedin_url: string | null;
  x_handle: string | null;
  sort_order: number;
};

type PostRow = {
  id: string;
  profile_id: string;
  platform: Platform;
  status: PostStatus;
  content_html: string;
  content_text: string;
  scheduled_at: string | null;
  approved_at: string | null;
  approved_by_name: string | null;
  published_at: string | null;
  published_url: string | null;
  created_by_name: string | null;
  updated_by_name: string | null;
  created_at: string;
  updated_at: string;
  media_links: string[];
  cc_post_assets: { asset_id: string; position: number }[];
  cc_post_metrics: MetricRow[];
};

type MetricRow = {
  captured_at: string;
  impressions: number | null;
  reactions: number | null;
  comments: number | null;
  reposts: number | null;
  clicks: number | null;
  source: MetricSource;
};

type AssetRow = {
  id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  created_by_name: string | null;
  created_at: string;
  cc_post_assets: { post_id: string }[];
};

const PROFILE_COLUMNS =
  "id,name,kind,avatar_url,linkedin_url,x_handle,sort_order";
const POST_COLUMNS =
  "id,profile_id,platform,status,content_html,content_text,scheduled_at,approved_at,approved_by_name,published_at,published_url,created_by_name,updated_by_name,created_at,updated_at,media_links,cc_post_assets(asset_id,position),cc_post_metrics(captured_at,impressions,reactions,comments,reposts,clicks,source)";
const ASSET_COLUMNS =
  "id,file_name,mime_type,size_bytes,width,height,created_by_name,created_at,cc_post_assets(post_id)";

function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    avatarUrl: row.avatar_url,
    linkedinUrl: row.linkedin_url,
    xHandle: row.x_handle,
    sortOrder: row.sort_order,
  };
}

function toMetrics(rows: readonly MetricRow[]): PostMetrics | null {
  const latest = [...rows].sort((a, b) =>
    b.captured_at.localeCompare(a.captured_at),
  )[0];
  if (!latest) return null;
  return {
    capturedAt: latest.captured_at,
    impressions: latest.impressions,
    reactions: latest.reactions,
    comments: latest.comments,
    reposts: latest.reposts,
    clicks: latest.clicks,
    source: latest.source,
  };
}

function toPost(row: PostRow): Post {
  return {
    id: row.id,
    profileId: row.profile_id,
    platform: row.platform,
    status: row.status,
    contentHtml: row.content_html,
    contentText: row.content_text,
    scheduledAt: row.scheduled_at,
    approvedAt: row.approved_at,
    approvedByName: row.approved_by_name,
    publishedAt: row.published_at,
    publishedUrl: row.published_url,
    createdByName: row.created_by_name,
    updatedByName: row.updated_by_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    assetIds: [...row.cc_post_assets]
      .sort((a, b) => a.position - b.position)
      .map((link) => link.asset_id),
    mediaLinks: row.media_links,
    metrics: toMetrics(row.cc_post_metrics),
  };
}

function toAsset(row: AssetRow): Asset {
  return {
    id: row.id,
    fileName: row.file_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    width: row.width,
    height: row.height,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
    url: `/api/assets/${row.id}/file`,
    usedInPostIds: row.cc_post_assets.map((link) => link.post_id),
  };
}

/* -------------------------------------------------------------- profiles */

export async function listProfiles(workspaceId: string): Promise<Profile[]> {
  const rows = must(
    await db()
      .from("cc_profiles")
      .select(PROFILE_COLUMNS)
      .eq("workspace_id", workspaceId)
      .is("archived_at", null)
      .order("sort_order")
      .order("name"),
    "list profiles",
  ) as ProfileRow[];
  return rows.map(toProfile);
}

export type ProfileInput = {
  name: string;
  kind: "person" | "company";
  avatarUrl: string | null;
  linkedinUrl: string | null;
  xHandle: string | null;
};

export function validateProfileInput(input: Partial<ProfileInput>): ProfileInput {
  const name = (input.name ?? "").trim();
  if (name.length === 0) fail(400, "name_required", "Add a name.");
  if (input.kind !== "person" && input.kind !== "company") {
    fail(400, "bad_kind", "Kind must be person or company.");
  }
  const xHandle = cleanHandle(input.xHandle ?? null);
  const linkedinUrl = cleanUrl(input.linkedinUrl ?? null, "LinkedIn URL");
  const avatarUrl = cleanUrl(input.avatarUrl ?? null, "Avatar URL");
  if (!xHandle && !linkedinUrl) {
    fail(400, "account_required", "Add an X handle, a LinkedIn URL, or both.");
  }
  return { name, kind: input.kind, avatarUrl, linkedinUrl, xHandle };
}

function cleanHandle(value: string | null): string | null {
  if (value === null) return null;
  const handle = value.trim().replace(/^@/, "").replace(/^https?:\/\/(x|twitter)\.com\//, "");
  if (handle.length === 0) return null;
  if (!/^[A-Za-z0-9_]{1,15}$/.test(handle)) {
    fail(400, "bad_x_handle", `"${value}" is not an X handle.`);
  }
  return handle;
}

function cleanUrl(value: string | null, label: string): string | null {
  if (value === null || value.trim().length === 0) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error();
    return url.toString();
  } catch {
    fail(400, "bad_url", `${label} must be a full https:// link.`);
  }
}

export async function createProfile(
  workspaceId: string,
  input: ProfileInput,
): Promise<Profile> {
  const row = must(
    await db()
      .from("cc_profiles")
      .insert({
        workspace_id: workspaceId,
        name: input.name,
        kind: input.kind,
        avatar_url: input.avatarUrl,
        linkedin_url: input.linkedinUrl,
        x_handle: input.xHandle,
      })
      .select(PROFILE_COLUMNS)
      .single(),
    "create profile",
  ) as ProfileRow;
  return toProfile(row);
}

export async function updateProfile(
  workspaceId: string,
  id: string,
  input: ProfileInput,
): Promise<Profile> {
  const rows = must(
    await db()
      .from("cc_profiles")
      .update({
        name: input.name,
        kind: input.kind,
        avatar_url: input.avatarUrl,
        linkedin_url: input.linkedinUrl,
        x_handle: input.xHandle,
        updated_at: new Date().toISOString(),
      })
      .eq("workspace_id", workspaceId)
      .eq("id", id)
      .is("archived_at", null)
      .select(PROFILE_COLUMNS),
    "update profile",
  ) as ProfileRow[];
  const row = rows[0];
  if (!row) fail(404, "profile_not_found", "That account no longer exists.");
  return toProfile(row);
}

export async function archiveProfile(workspaceId: string, id: string): Promise<void> {
  const rows = must(
    await db()
      .from("cc_profiles")
      .update({ archived_at: new Date().toISOString() })
      .eq("workspace_id", workspaceId)
      .eq("id", id)
      .is("archived_at", null)
      .select("id"),
    "archive profile",
  ) as { id: string }[];
  if (rows.length === 0) fail(404, "profile_not_found", "That account no longer exists.");
}

async function requireProfile(workspaceId: string, id: string): Promise<Profile> {
  const rows = must(
    await db()
      .from("cc_profiles")
      .select(PROFILE_COLUMNS)
      .eq("workspace_id", workspaceId)
      .eq("id", id)
      .is("archived_at", null),
    "read profile",
  ) as ProfileRow[];
  const row = rows[0];
  if (!row) fail(400, "profile_not_found", "Pick an account to post from.");
  return toProfile(row);
}

/* ----------------------------------------------------------------- posts */

export async function listPosts(
  workspaceId: string,
  range: { from: string | null; to: string | null },
): Promise<Post[]> {
  let query = db()
    .from("cc_posts")
    .select(POST_COLUMNS)
    .eq("workspace_id", workspaceId);
  if (range.from && range.to) {
    // Drafts have no date; they always come back so the queue can show them.
    query = query.or(
      `status.eq.draft,and(status.eq.scheduled,scheduled_at.gte.${range.from},scheduled_at.lt.${range.to}),and(status.eq.published,published_at.gte.${range.from},published_at.lt.${range.to})`,
    );
  }
  const rows = must(
    await query.order("updated_at", { ascending: false }).limit(2000),
    "list posts",
  ) as PostRow[];
  return rows.map(toPost);
}

export async function getPost(workspaceId: string, id: string): Promise<Post> {
  const rows = must(
    await db()
      .from("cc_posts")
      .select(POST_COLUMNS)
      .eq("workspace_id", workspaceId)
      .eq("id", id),
    "read post",
  ) as PostRow[];
  const row = rows[0];
  if (!row) fail(404, "post_not_found", "That post no longer exists.");
  return toPost(row);
}

export function validatePostInput(input: Partial<PostInput>): PostInput {
  if (!input.platform || !(PLATFORMS as readonly string[]).includes(input.platform)) {
    fail(400, "bad_platform", "Pick LinkedIn or X.");
  }
  if (typeof input.profileId !== "string" || input.profileId.length === 0) {
    fail(400, "profile_required", "Pick an account to post from.");
  }
  const contentText = typeof input.contentText === "string" ? input.contentText : "";
  const contentHtml = typeof input.contentHtml === "string" ? input.contentHtml : "";
  const assetIds = Array.isArray(input.assetIds) ? input.assetIds.filter((id) => typeof id === "string") : [];
  if (new Set(assetIds).size !== assetIds.length) {
    fail(400, "duplicate_asset", "The same file is attached twice.");
  }
  if (assetIds.length > MAX_POST_IMAGES) {
    fail(400, "too_many_images", `A post can carry up to ${MAX_POST_IMAGES} attachments.`);
  }
  const mediaLinks = input.mediaLinks === undefined ? undefined : validateMediaLinks(input.mediaLinks);
  let scheduledAt: string | null = null;
  if (input.scheduledAt) {
    const when = new Date(input.scheduledAt);
    if (Number.isNaN(when.getTime())) fail(400, "bad_time", "That date and time is not valid.");
    scheduledAt = when.toISOString();
    if (contentText.trim().length === 0 && assetIds.length === 0 && (mediaLinks ?? []).length === 0) {
      fail(400, "empty_post", "Write something before scheduling.");
    }
  }
  return {
    platform: input.platform,
    profileId: input.profileId,
    contentText,
    contentHtml,
    scheduledAt,
    assetIds,
    ...(mediaLinks === undefined ? {} : { mediaLinks }),
  };
}

function validateMediaLinks(raw: unknown): string[] {
  if (!Array.isArray(raw) || raw.some((link) => typeof link !== "string")) {
    fail(400, "bad_media_links", "mediaLinks must be a list of YouTube or Google Drive links.");
  }
  const links = (raw as string[]).map((link) => {
    const parsed = parseMediaLink(link);
    if (!parsed.ok) fail(400, "bad_media_link", parsed.message);
    return parsed.url;
  });
  if (new Set(links).size !== links.length) fail(400, "duplicate_media_link", "The same link is added twice.");
  if (links.length > MAX_MEDIA_LINKS) {
    fail(400, "too_many_media_links", `A post can carry up to ${MAX_MEDIA_LINKS} links.`);
  }
  return links;
}

async function assertProfileHasPlatform(
  workspaceId: string,
  profileId: string,
  platform: Platform,
): Promise<void> {
  const profile = await requireProfile(workspaceId, profileId);
  switch (platform) {
    case "x":
      if (!profile.xHandle) fail(400, "no_x_account", `${profile.name} has no X account yet. Add one in Settings.`);
      return;
    case "linkedin":
      if (!profile.linkedinUrl) fail(400, "no_linkedin_account", `${profile.name} has no LinkedIn yet. Add one in Settings.`);
      return;
    default:
      assertNever(platform);
  }
}

/** The attachments exist here and can post together on the platform. */
async function assertPostMedia(workspaceId: string, platform: Platform, assetIds: readonly string[]): Promise<void> {
  if (assetIds.length === 0) return;
  const rows = must(
    await db()
      .from("cc_assets")
      .select("id,mime_type")
      .eq("workspace_id", workspaceId)
      .is("archived_at", null)
      .in("id", [...assetIds]),
    "check assets",
  ) as { id: string; mime_type: string }[];
  if (rows.length !== assetIds.length) {
    fail(400, "asset_not_found", "One of the attached files was deleted. Remove it and try again.");
  }
  const problem = postMediaProblem(platform, rows.map((row) => row.mime_type));
  if (problem) fail(400, "bad_media_mix", problem);
}

async function replacePostAssets(postId: string, assetIds: readonly string[]): Promise<void> {
  must(
    await db().from("cc_post_assets").delete().eq("post_id", postId).select("post_id"),
    "clear post images",
  );
  if (assetIds.length === 0) return;
  must(
    await db()
      .from("cc_post_assets")
      .insert(assetIds.map((assetId, position) => ({ post_id: postId, asset_id: assetId, position })))
      .select("post_id"),
    "attach post images",
  );
}

export async function createPost(
  workspaceId: string,
  author: { id: string; name: string },
  input: PostInput,
): Promise<Post> {
  await assertProfileHasPlatform(workspaceId, input.profileId, input.platform);
  await assertPostMedia(workspaceId, input.platform, input.assetIds);
  const row = must(
    await db()
      .from("cc_posts")
      .insert({
        workspace_id: workspaceId,
        profile_id: input.profileId,
        platform: input.platform,
        status: input.scheduledAt ? "scheduled" : "draft",
        content_html: input.contentHtml,
        content_text: input.contentText,
        scheduled_at: input.scheduledAt,
        media_links: input.mediaLinks ?? [],
        created_by_user_id: author.id,
        created_by_name: author.name,
        updated_by_name: author.name,
      })
      .select("id")
      .single(),
    "create post",
  ) as { id: string };
  await replacePostAssets(row.id, input.assetIds);
  return getPost(workspaceId, row.id);
}

export async function updatePost(
  workspaceId: string,
  author: { name: string },
  id: string,
  input: PostInput,
): Promise<Post> {
  const current = await getPost(workspaceId, id);
  if (current.status === "published") {
    fail(409, "already_published", "This post is already live. Editing it here won't change it on the platform.");
  }
  await assertProfileHasPlatform(workspaceId, input.profileId, input.platform);
  await assertPostMedia(workspaceId, input.platform, input.assetIds);
  // Left out (an older client or an agent editing text) keeps the current links.
  const mediaLinks = input.mediaLinks ?? current.mediaLinks;
  const textChanged =
    current.contentText !== input.contentText ||
    current.profileId !== input.profileId ||
    current.platform !== input.platform ||
    current.assetIds.join(",") !== input.assetIds.join(",") ||
    current.mediaLinks.join("\n") !== mediaLinks.join("\n");
  must(
    await db()
      .from("cc_posts")
      .update({
        profile_id: input.profileId,
        platform: input.platform,
        status: input.scheduledAt ? "scheduled" : "draft",
        content_html: input.contentHtml,
        content_text: input.contentText,
        scheduled_at: input.scheduledAt,
        media_links: mediaLinks,
        updated_by_name: author.name,
        updated_at: new Date().toISOString(),
        // Approval covers one exact post; any change asks for it again.
        ...(textChanged ? { approved_at: null, approved_by_name: null } : {}),
      })
      .eq("workspace_id", workspaceId)
      .eq("id", id)
      .select("id"),
    "update post",
  );
  await replacePostAssets(id, input.assetIds);
  return getPost(workspaceId, id);
}

export async function deletePost(workspaceId: string, id: string): Promise<void> {
  const rows = must(
    await db().from("cc_posts").delete().eq("workspace_id", workspaceId).eq("id", id).select("id"),
    "delete post",
  ) as { id: string }[];
  if (rows.length === 0) fail(404, "post_not_found", "That post no longer exists.");
}

export async function approvePost(
  workspaceId: string,
  approver: { name: string },
  id: string,
): Promise<Post> {
  const post = await getPost(workspaceId, id);
  if (post.status === "published") fail(409, "already_published", "This post is already live.");
  if (post.contentText.trim().length === 0 && post.assetIds.length === 0 && post.mediaLinks.length === 0) {
    fail(400, "empty_post", "Write something before approving.");
  }
  must(
    await db()
      .from("cc_posts")
      .update({ approved_at: new Date().toISOString(), approved_by_name: approver.name })
      .eq("workspace_id", workspaceId)
      .eq("id", id)
      .select("id"),
    "approve post",
  );
  return getPost(workspaceId, id);
}

export async function markPublished(
  workspaceId: string,
  actor: { name: string },
  id: string,
  publishedUrl: string | null,
): Promise<Post> {
  const post = await getPost(workspaceId, id);
  if (!post.approvedAt) {
    fail(409, "not_approved", "Approve this post before marking it as posted.");
  }
  const url = publishedUrl ? cleanPostUrl(publishedUrl, post.platform) : null;
  must(
    await db()
      .from("cc_posts")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
        published_url: url,
        updated_by_name: actor.name,
        updated_at: new Date().toISOString(),
      })
      .eq("workspace_id", workspaceId)
      .eq("id", id)
      .select("id"),
    "mark published",
  );
  return getPost(workspaceId, id);
}

export async function setPublishedUrl(workspaceId: string, id: string, publishedUrl: string | null): Promise<Post> {
  const post = await getPost(workspaceId, id);
  if (post.status !== "published") fail(409, "not_published", "Only posted items have a live link.");
  must(
    await db()
      .from("cc_posts")
      .update({ published_url: publishedUrl ? cleanPostUrl(publishedUrl, post.platform) : null })
      .eq("workspace_id", workspaceId)
      .eq("id", id)
      .select("id"),
    "set post link",
  );
  return getPost(workspaceId, id);
}

/** Undo "mark as posted" (wrong post marked). Keeps the schedule. */
export async function unmarkPublished(workspaceId: string, actor: { name: string }, id: string): Promise<Post> {
  const post = await getPost(workspaceId, id);
  if (post.status !== "published") fail(409, "not_published", "This post isn't marked as posted.");
  must(
    await db()
      .from("cc_posts")
      .update({
        status: post.scheduledAt ? "scheduled" : "draft",
        published_at: null,
        published_url: null,
        updated_by_name: actor.name,
        updated_at: new Date().toISOString(),
      })
      .eq("workspace_id", workspaceId)
      .eq("id", id)
      .select("id"),
    "unmark published",
  );
  return getPost(workspaceId, id);
}

function cleanPostUrl(value: string, platform: Platform): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    fail(400, "bad_url", "Paste the full link to the live post.");
  }
  const host = url.hostname.replace(/^www\./, "");
  switch (platform) {
    case "x":
      if (host !== "x.com" && host !== "twitter.com") fail(400, "bad_url", "That isn't an x.com link.");
      break;
    case "linkedin":
      // lnkd.in is LinkedIn's own short link, what its "Copy link" often gives.
      if (host !== "linkedin.com" && !host.endsWith(".linkedin.com") && host !== "lnkd.in") {
        fail(400, "bad_url", "That isn't a LinkedIn link (linkedin.com or lnkd.in).");
      }
      break;
    default:
      assertNever(platform);
  }
  return url.toString();
}

/* --------------------------------------------------------------- metrics */

export type MetricsInput = {
  impressions: number | null;
  reactions: number | null;
  comments: number | null;
  reposts: number | null;
  clicks: number | null;
};

export function validateMetricsInput(input: Partial<MetricsInput>): MetricsInput {
  const read = (key: keyof MetricsInput): number | null => {
    const value = input[key];
    if (value === null || value === undefined) return null;
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
      fail(400, "bad_metric", `${key} must be a whole number of 0 or more.`);
    }
    return value;
  };
  const metrics = {
    impressions: read("impressions"),
    reactions: read("reactions"),
    comments: read("comments"),
    reposts: read("reposts"),
    clicks: read("clicks"),
  };
  if (Object.values(metrics).every((value) => value === null)) {
    fail(400, "no_metrics", "Enter at least one number.");
  }
  return metrics;
}

export async function recordMetrics(
  workspaceId: string,
  actor: { name: string },
  postId: string,
  metrics: MetricsInput,
): Promise<Post> {
  const post = await getPost(workspaceId, postId);
  if (post.status !== "published") fail(409, "not_published", "Metrics only apply to posts that are live.");
  must(
    await db()
      .from("cc_post_metrics")
      .insert({ post_id: postId, ...metrics, source: "manual", entered_by_name: actor.name })
      .select("id"),
    "record metrics",
  );
  return getPost(workspaceId, postId);
}

export async function listFollowerSnapshots(workspaceId: string): Promise<FollowerSnapshot[]> {
  const rows = must(
    await db()
      .from("cc_follower_snapshots")
      .select("profile_id,platform,captured_on,followers,cc_profiles!inner(workspace_id)")
      .eq("cc_profiles.workspace_id", workspaceId)
      .order("captured_on"),
    "list follower counts",
  ) as { profile_id: string; platform: Platform; captured_on: string; followers: number }[];
  return rows.map((row) => ({
    profileId: row.profile_id,
    platform: row.platform,
    capturedOn: row.captured_on,
    followers: row.followers,
  }));
}

export async function recordFollowers(
  workspaceId: string,
  input: { profileId: string; platform: Platform; followers: number; capturedOn: string },
): Promise<void> {
  await assertProfileHasPlatform(workspaceId, input.profileId, input.platform);
  if (!Number.isInteger(input.followers) || input.followers < 0) {
    fail(400, "bad_followers", "Followers must be a whole number.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.capturedOn)) fail(400, "bad_date", "Pick a date.");
  must(
    await db()
      .from("cc_follower_snapshots")
      .upsert(
        {
          profile_id: input.profileId,
          platform: input.platform,
          captured_on: input.capturedOn,
          followers: input.followers,
          source: "manual",
        },
        { onConflict: "profile_id,platform,captured_on" },
      )
      .select("id"),
    "record followers",
  );
}

/* ---------------------------------------------------------------- assets */

export async function listAssets(workspaceId: string): Promise<Asset[]> {
  const rows = must(
    await db()
      .from("cc_assets")
      .select(ASSET_COLUMNS)
      .eq("workspace_id", workspaceId)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(1000),
    "list assets",
  ) as AssetRow[];
  return rows.map(toAsset);
}

export async function insertAsset(
  workspaceId: string,
  row: {
    id: string;
    storagePath: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    width: number | null;
    height: number | null;
    createdByName: string;
  },
): Promise<Asset> {
  const inserted = must(
    await db()
      .from("cc_assets")
      .insert({
        id: row.id,
        workspace_id: workspaceId,
        storage_path: row.storagePath,
        file_name: row.fileName,
        mime_type: row.mimeType,
        size_bytes: row.sizeBytes,
        width: row.width,
        height: row.height,
        created_by_name: row.createdByName,
      })
      .select(ASSET_COLUMNS)
      .single(),
    "save asset",
  ) as AssetRow;
  return toAsset(inserted);
}

export async function assetStoragePath(workspaceId: string, id: string): Promise<{ path: string; mimeType: string; fileName: string }> {
  const rows = must(
    await db()
      .from("cc_assets")
      .select("storage_path,mime_type,file_name")
      .eq("workspace_id", workspaceId)
      .eq("id", id),
    "read asset",
  ) as { storage_path: string; mime_type: string; file_name: string }[];
  const row = rows[0];
  if (!row) fail(404, "asset_not_found", "That image no longer exists.");
  return { path: row.storage_path, mimeType: row.mime_type, fileName: row.file_name };
}

export async function renameAsset(workspaceId: string, id: string, fileName: string): Promise<void> {
  const name = fileName.trim();
  if (name.length === 0) fail(400, "name_required", "Give the image a name.");
  const rows = must(
    await db().from("cc_assets").update({ file_name: name }).eq("workspace_id", workspaceId).eq("id", id).select("id"),
    "rename asset",
  ) as { id: string }[];
  if (rows.length === 0) fail(404, "asset_not_found", "That image no longer exists.");
}

/** Hide an image from the library. Refused while a draft or scheduled post still uses it. */
export async function archiveAsset(workspaceId: string, id: string): Promise<void> {
  const links = must(
    await db()
      .from("cc_post_assets")
      .select("post_id,cc_posts!inner(status,workspace_id)")
      .eq("asset_id", id)
      .eq("cc_posts.workspace_id", workspaceId)
      .neq("cc_posts.status", "published"),
    "check asset use",
  ) as { post_id: string }[];
  if (links.length > 0) {
    fail(409, "asset_in_use", `This image is attached to ${links.length} unpublished post${links.length === 1 ? "" : "s"}. Remove it there first.`);
  }
  const rows = must(
    await db()
      .from("cc_assets")
      .update({ archived_at: new Date().toISOString() })
      .eq("workspace_id", workspaceId)
      .eq("id", id)
      .is("archived_at", null)
      .select("id"),
    "delete asset",
  ) as { id: string }[];
  if (rows.length === 0) fail(404, "asset_not_found", "That image no longer exists.");
}
