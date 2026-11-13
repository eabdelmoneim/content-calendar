import { handle, readJson } from "@/server/http";
import { archiveProfile, updateProfile, validateProfileInput, type ProfileInput } from "@/server/repo";
import { currentWorkspace } from "@/server/session";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context): Promise<Response> {
  return handle(async () => {
    const { id } = await params;
    const input = validateProfileInput(await readJson<Partial<ProfileInput>>(request));
    const workspace = await currentWorkspace();
    return { profile: await updateProfile(workspace.id, id, input) };
  });
}

export async function DELETE(_request: Request, { params }: Context): Promise<Response> {
  return handle(async () => {
    const { id } = await params;
    const workspace = await currentWorkspace();
    await archiveProfile(workspace.id, id);
    return { ok: true };
  });
}
