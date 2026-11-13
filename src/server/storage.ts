import "server-only";

import { ASSET_BUCKET, storageBase } from "./db";

function authHeaders(): { url: string; headers: Record<string, string> } {
  const { url, key } = storageBase();
  return { url, headers: { apikey: key, Authorization: `Bearer ${key}` } };
}

/**
 * A one-path, short-lived URL the browser PUTs the file to directly, so large
 * videos never pass through (or sit in the memory of) this server.
 */
export async function signUpload(path: string): Promise<string> {
  const { url, headers } = authHeaders();
  const resp = await fetch(`${url}/object/upload/sign/${ASSET_BUCKET}/${path}`, { method: "POST", headers });
  if (!resp.ok) throw new Error(`Storage upload signing failed (${resp.status}): ${await resp.text()}`);
  const body = (await resp.json()) as { url?: unknown };
  if (typeof body.url !== "string") throw new Error("Storage upload signing returned no URL");
  return `${url}${body.url}`;
}

export type StoredObject = { size: number; contentType: string };

/** Size and type of an uploaded object, or null when nothing is stored at the path. */
export async function objectInfo(path: string): Promise<StoredObject | null> {
  const { url, headers } = authHeaders();
  const resp = await fetch(`${url}/object/info/authenticated/${ASSET_BUCKET}/${path}`, { headers });
  if (resp.status === 400 || resp.status === 404) return null;
  if (!resp.ok) throw new Error(`Storage info failed (${resp.status}): ${await resp.text()}`);
  const body = (await resp.json()) as { size?: unknown; content_type?: unknown };
  if (typeof body.size !== "number" || typeof body.content_type !== "string") {
    throw new Error("Storage info returned no size or content type");
  }
  return { size: body.size, contentType: body.content_type };
}

/** Pass the browser's Range header through so video can seek. */
export async function getObject(path: string, range: string | null = null): Promise<Response> {
  const { url, headers } = authHeaders();
  return fetch(`${url}/object/authenticated/${ASSET_BUCKET}/${path}`, {
    headers: range ? { ...headers, Range: range } : headers,
  });
}

export async function removeObject(path: string): Promise<void> {
  const { url, headers } = authHeaders();
  const resp = await fetch(`${url}/object/${ASSET_BUCKET}`, {
    method: "DELETE",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes: [path] }),
  });
  if (!resp.ok) throw new Error(`Storage delete failed (${resp.status}): ${await resp.text()}`);
}
