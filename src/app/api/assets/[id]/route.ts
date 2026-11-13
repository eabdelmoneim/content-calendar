import { handle, readJson } from "@/server/http";
import { archiveAsset, renameAsset } from "@/server/repo";
import { currentWorkspace } from "@/server/session";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Context): Promise<Response> {
  return handle(async () => {
    const { id } = await params;
    const body = await readJson<{ fileName: string }>(request);
    const workspace = await currentWorkspace();
    await renameAsset(workspace.id, id, String(body.fileName ?? ""));
    return { ok: true };
  });
}

/** Archive (keeps the file so published posts that used it stay explainable). */
export async function DELETE(_request: Request, { params }: Context): Promise<Response> {
  return handle(async () => {
    const { id } = await params;
    const workspace = await currentWorkspace();
    await archiveAsset(workspace.id, id);
    return { ok: true };
  });
}
