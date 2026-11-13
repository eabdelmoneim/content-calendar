import type { PostInput } from "@/lib/types";
import { handle, readJson } from "@/server/http";
import { deletePost, getPost, updatePost, validatePostInput } from "@/server/repo";
import { currentSession, currentWorkspace } from "@/server/session";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context): Promise<Response> {
  return handle(async () => {
    const { id } = await params;
    const workspace = await currentWorkspace();
    return { post: await getPost(workspace.id, id) };
  });
}

export async function PATCH(request: Request, { params }: Context): Promise<Response> {
  return handle(async () => {
    const { id } = await params;
    const input = validatePostInput(await readJson<Partial<PostInput>>(request));
    const { workspace, user } = await currentSession();
    return { post: await updatePost(workspace.id, user, id, input) };
  });
}

export async function DELETE(_request: Request, { params }: Context): Promise<Response> {
  return handle(async () => {
    const { id } = await params;
    const workspace = await currentWorkspace();
    await deletePost(workspace.id, id);
    return { ok: true };
  });
}
