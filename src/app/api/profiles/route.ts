import { handle, readJson } from "@/server/http";
import { createProfile, listProfiles, validateProfileInput, type ProfileInput } from "@/server/repo";
import { currentWorkspace } from "@/server/session";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return handle(async () => {
    const workspace = await currentWorkspace();
    return { profiles: await listProfiles(workspace.id) };
  });
}

export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const input = validateProfileInput(await readJson<Partial<ProfileInput>>(request));
    const workspace = await currentWorkspace();
    return { profile: await createProfile(workspace.id, input) };
  });
}
