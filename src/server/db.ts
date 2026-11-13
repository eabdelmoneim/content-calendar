import "server-only";

import { PostgrestClient } from "@supabase/postgrest-js";

/**
 * Server-only PostgREST client for the nebula-web Supabase project.
 *
 * Uses SUPABASE_SECRET_KEY (bypasses RLS; the cc_* tables have RLS on with no
 * policies, so nothing else can read them). Never import from a client file.
 * CC_REST_URL / CC_REST_KEY point local development at a local PostgREST.
 */
export function db(): PostgrestClient {
  const restUrl =
    process.env.CC_REST_URL ?? `${requireEnv("SUPABASE_URL")}/rest/v1`;
  const key = process.env.CC_REST_KEY ?? requireEnv("SUPABASE_SECRET_KEY");
  return new PostgrestClient(restUrl, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
}

export const ASSET_BUCKET = "cc-assets";

export function storageBase(): { url: string; key: string } {
  return {
    url: `${requireEnv("SUPABASE_URL")}/storage/v1`,
    key: requireEnv("SUPABASE_SECRET_KEY"),
  };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set on the miniapp service`);
  return value;
}
