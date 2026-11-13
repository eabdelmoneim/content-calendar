import type { Platform } from "@/lib/types";
import { handle, readJson } from "@/server/http";
import { listFollowerSnapshots, recordFollowers } from "@/server/repo";
import { currentWorkspace } from "@/server/session";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return handle(async () => {
    const workspace = await currentWorkspace();
    return { snapshots: await listFollowerSnapshots(workspace.id) };
  });
}

export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const body = await readJson<{ profileId: string; platform: Platform; followers: number; capturedOn: string }>(request);
    const workspace = await currentWorkspace();
    await recordFollowers(workspace.id, body);
    return { ok: true };
  });
}
