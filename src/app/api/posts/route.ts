import type { PostInput } from "@/lib/types";
import { handle, readJson } from "@/server/http";
import { createPost, listPosts, validatePostInput } from "@/server/repo";
import { currentSession, currentWorkspace } from "@/server/session";

export const dynamic = "force-dynamic";

/** ?from=ISO&to=ISO limits scheduled/published posts to a range; drafts always return. */
export async function GET(request: Request): Promise<Response> {
  return handle(async () => {
    const url = new URL(request.url);
    const workspace = await currentWorkspace();
    const posts = await listPosts(workspace.id, {
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
    });
    return { posts };
  });
}

export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const input = validatePostInput(await readJson<Partial<PostInput>>(request));
    const { workspace, user } = await currentSession();
    return { post: await createPost(workspace.id, user, input) };
  });
}
