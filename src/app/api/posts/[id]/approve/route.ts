import { handle } from "@/server/http";
import { approvePost } from "@/server/repo";
import { currentSession } from "@/server/session";

type Context = { params: Promise<{ id: string }> };

/** A person approves this exact post. Any later edit clears the approval. */
export async function POST(_request: Request, { params }: Context): Promise<Response> {
  return handle(async () => {
    const { id } = await params;
    const { workspace, user } = await currentSession();
    return { post: await approvePost(workspace.id, user, id) };
  });
}
