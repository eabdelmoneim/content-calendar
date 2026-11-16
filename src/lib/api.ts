"use client";

import { mediaKind } from "./media";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";

import type {
  Asset,
  AssetTodo,
  FollowerSnapshot,
  Platform,
  Post,
  PostInput,
  Profile,
  Session,
} from "./types";

/** An API failure with the server's typed code and readable message. */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(path, {
    ...init,
    headers:
      init?.body instanceof FormData
        ? init.headers
        : { "Content-Type": "application/json", ...init?.headers },
  });
  const text = await resp.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    throw new ApiRequestError(resp.status, "bad_response", `The server answered ${resp.status} without JSON.`);
  }
  if (!resp.ok) {
    const error = (body as { error?: { code: string; message: string } } | null)?.error;
    throw new ApiRequestError(resp.status, error?.code ?? "http_error", error?.message ?? `Request failed (${resp.status}).`);
  }
  return body as T;
}

const json = (value: unknown): string => JSON.stringify(value);

export const keys = {
  session: ["session"] as const,
  profiles: ["profiles"] as const,
  posts: ["posts"] as const,
  assets: ["assets"] as const,
  followers: ["followers"] as const,
  todos: ["asset-todos"] as const,
};

/* ----------------------------------------------------------- reads */

export function useSession(): UseQueryResult<Session> {
  return useQuery({ queryKey: keys.session, queryFn: () => api<Session>("/api/session"), staleTime: 5 * 60_000 });
}

export function useProfiles(): UseQueryResult<Profile[]> {
  return useQuery({
    queryKey: keys.profiles,
    queryFn: async () => (await api<{ profiles: Profile[] }>("/api/profiles")).profiles,
  });
}

/** Every post in the workspace (drafts, scheduled, published). Screens filter client-side. */
export function usePosts(): UseQueryResult<Post[]> {
  return useQuery({
    queryKey: keys.posts,
    queryFn: async () => (await api<{ posts: Post[] }>("/api/posts")).posts,
    refetchInterval: 60_000,
  });
}

export function useAssets(): UseQueryResult<Asset[]> {
  return useQuery({
    queryKey: keys.assets,
    queryFn: async () => (await api<{ assets: Asset[] }>("/api/assets")).assets,
  });
}

export function useAssetTodos(): UseQueryResult<AssetTodo[]> {
  return useQuery({
    queryKey: keys.todos,
    queryFn: async () => (await api<{ todos: AssetTodo[] }>("/api/asset-todos")).todos,
    refetchInterval: 60_000,
  });
}

export function useFollowerSnapshots(): UseQueryResult<FollowerSnapshot[]> {
  return useQuery({
    queryKey: keys.followers,
    queryFn: async () => (await api<{ snapshots: FollowerSnapshot[] }>("/api/followers")).snapshots,
  });
}

/* ----------------------------------------------------------- writes */

export type ProfileFields = Omit<Profile, "id" | "sortOrder">;

function useInvalidate(...targets: (readonly string[])[]): () => Promise<void> {
  const client = useQueryClient();
  return async () => {
    await Promise.all(targets.map((queryKey) => client.invalidateQueries({ queryKey })));
  };
}

export function useSaveProfile() {
  const invalidate = useInvalidate(keys.profiles);
  return useMutation({
    mutationFn: ({ id, fields }: { id: string | null; fields: ProfileFields }) =>
      api<{ profile: Profile }>(id ? `/api/profiles/${id}` : "/api/profiles", {
        method: id ? "PATCH" : "POST",
        body: json(fields),
      }).then((r) => r.profile),
    onSuccess: invalidate,
  });
}

export function useArchiveProfile() {
  const invalidate = useInvalidate(keys.profiles);
  return useMutation({
    mutationFn: (id: string) => api(`/api/profiles/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}

export function useSavePost() {
  const invalidate = useInvalidate(keys.posts, keys.assets);
  return useMutation({
    mutationFn: ({ id, input }: { id: string | null; input: PostInput }) =>
      api<{ post: Post }>(id ? `/api/posts/${id}` : "/api/posts", {
        method: id ? "PATCH" : "POST",
        body: json(input),
      }).then((r) => r.post),
    onSuccess: invalidate,
  });
}

export function useDeletePost() {
  const invalidate = useInvalidate(keys.posts, keys.assets);
  return useMutation({
    mutationFn: (id: string) => api(`/api/posts/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}

export function useApprovePost() {
  const invalidate = useInvalidate(keys.posts);
  return useMutation({
    mutationFn: (id: string) => api<{ post: Post }>(`/api/posts/${id}/approve`, { method: "POST" }).then((r) => r.post),
    onSuccess: invalidate,
  });
}

export type PublishAction =
  | { action: "mark"; publishedUrl: string | null }
  | { action: "set_url"; publishedUrl: string | null }
  | { action: "unmark" };

export function usePublishAction() {
  const invalidate = useInvalidate(keys.posts);
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: PublishAction }) =>
      api<{ post: Post }>(`/api/posts/${id}/publish`, { method: "POST", body: json(body) }).then((r) => r.post),
    onSuccess: invalidate,
  });
}

export type MetricsFields = {
  impressions: number | null;
  reactions: number | null;
  comments: number | null;
  reposts: number | null;
  clicks: number | null;
};

export function useRecordMetrics() {
  const invalidate = useInvalidate(keys.posts);
  return useMutation({
    mutationFn: ({ id, metrics }: { id: string; metrics: MetricsFields }) =>
      api<{ post: Post }>(`/api/posts/${id}/metrics`, { method: "POST", body: json(metrics) }).then((r) => r.post),
    onSuccess: invalidate,
  });
}

export function useRecordFollowers() {
  const invalidate = useInvalidate(keys.followers);
  return useMutation({
    mutationFn: (input: { profileId: string; platform: Platform; followers: number; capturedOn: string }) =>
      api("/api/followers", { method: "POST", body: json(input) }),
    onSuccess: invalidate,
  });
}

/** PUT the file straight to storage, reporting progress (fetch can't). */
function putToStorage(file: File, uploadUrl: string, onProgress: (percent: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onerror = () =>
      reject(new ApiRequestError(0, "network", `${file.name} could not reach storage. Check your connection and try again.`));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      let body: { statusCode?: unknown; message?: unknown } = {};
      try {
        body = JSON.parse(xhr.responseText) as typeof body;
      } catch {
        // Storage answered without JSON; fall back to the status-only message.
      }
      // Supabase reports "too large" as HTTP 400 with statusCode "413" in the body.
      if (xhr.status === 413 || body.statusCode === "413") {
        reject(
          new ApiRequestError(413, "storage_too_large", `${file.name} is bigger than storage currently accepts. Ask an admin to raise the Supabase upload limit.`),
        );
        return;
      }
      const message =
        typeof body.message === "string"
          ? `Upload of ${file.name} failed: ${body.message}`
          : `Upload of ${file.name} failed (${xhr.status}).`;
      reject(new ApiRequestError(xhr.status, "storage_upload_failed", message));
    };
    xhr.send(file);
  });
}

/**
 * Measures the image or video in the browser, uploads it directly to storage
 * through a signed URL, then records it in the library.
 */
export async function uploadAsset(file: File, onProgress: (percent: number) => void = () => {}): Promise<Asset> {
  const size = await measureMedia(file);
  const { id, uploadUrl } = await api<{ id: string; uploadUrl: string }>("/api/assets/uploads", {
    method: "POST",
    body: json({ fileName: file.name, mimeType: file.type, sizeBytes: file.size }),
  });
  await putToStorage(file, uploadUrl, onProgress);
  const body = json({ id, fileName: file.name, mimeType: file.type, width: size?.width, height: size?.height });
  return (await api<{ asset: Asset }>("/api/assets", { method: "POST", body })).asset;
}

function measureMedia(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const done = (size: { width: number; height: number } | null) => {
      URL.revokeObjectURL(url);
      resolve(size);
    };
    if (mediaKind(file.type) === "video") {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      video.onloadedmetadata = () =>
        done(video.videoWidth > 0 ? { width: video.videoWidth, height: video.videoHeight } : null);
      video.onerror = () => done(null);
      video.src = url;
      return;
    }
    const image = new Image();
    image.onload = () => done({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => done(null);
    image.src = url;
  });
}

export function useUploadAssets() {
  const invalidate = useInvalidate(keys.assets);
  return useMutation({
    mutationFn: async (files: File[]) => {
      const uploaded: Asset[] = [];
      for (const file of files) uploaded.push(await uploadAsset(file));
      return uploaded;
    },
    onSettled: invalidate,
  });
}

export function useRenameAsset() {
  const invalidate = useInvalidate(keys.assets);
  return useMutation({
    mutationFn: ({ id, fileName }: { id: string; fileName: string }) =>
      api(`/api/assets/${id}`, { method: "PATCH", body: json({ fileName }) }),
    onSuccess: invalidate,
  });
}

export function useArchiveAsset() {
  const invalidate = useInvalidate(keys.assets);
  return useMutation({
    mutationFn: (id: string) => api(`/api/assets/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}

export function useAddAssetTodo() {
  const invalidate = useInvalidate(keys.todos);
  return useMutation({
    mutationFn: (input: { title: string; dueOn: string | null; assigneeName: string | null }) =>
      api<{ todo: AssetTodo }>("/api/asset-todos", { method: "POST", body: json(input) }).then((r) => r.todo),
    onSuccess: invalidate,
  });
}

export type AssetTodoChanges = { title?: string; dueOn?: string | null; assigneeName?: string | null; done?: boolean };

/** Applies the change to the cached list at once and rolls back if the server refuses. */
export function useUpdateAssetTodo() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: AssetTodoChanges }) =>
      api<{ todo: AssetTodo }>(`/api/asset-todos/${id}`, { method: "PATCH", body: json(changes) }).then((r) => r.todo),
    onMutate: async ({ id, changes }) => {
      await client.cancelQueries({ queryKey: keys.todos });
      const previous = client.getQueryData<AssetTodo[]>(keys.todos);
      client.setQueryData<AssetTodo[]>(keys.todos, (list) =>
        list?.map((todo) =>
          todo.id !== id
            ? todo
            : {
                ...todo,
                ...(changes.title !== undefined ? { title: changes.title } : {}),
                ...(changes.dueOn !== undefined ? { dueOn: changes.dueOn } : {}),
                ...(changes.assigneeName !== undefined ? { assigneeName: changes.assigneeName } : {}),
                ...(changes.done !== undefined
                  ? { completedAt: changes.done ? new Date().toISOString() : null }
                  : {}),
              },
        ),
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) client.setQueryData(keys.todos, context.previous);
    },
    onSettled: () => client.invalidateQueries({ queryKey: keys.todos }),
  });
}

export function useRemoveAssetTodo() {
  const invalidate = useInvalidate(keys.todos);
  return useMutation({
    mutationFn: (id: string) => api(`/api/asset-todos/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}
