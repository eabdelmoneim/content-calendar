import { fail, handle, readJson } from "@/server/http";
import { markPublished, setPublishedUrl, unmarkPublished } from "@/server/repo";
import { currentSession } from "@/server/session";

type Context = { params: Promise<{ id: string }> };

type Body =
  | { action: "mark"; publishedUrl: string | null }
  | { action: "set_url"; publishedUrl: string | null }
  | { action: "unmark" };

/**
 * The app never posts by itself. A person posts through the X / LinkedIn
 * share link, then records it here ("mark"), adds the live link later
 * ("set_url"), or undoes a wrong mark ("unmark").
 */
export async function POST(request: Request, { params }: Context): Promise<Response> {
  return handle(async () => {
    const { id } = await params;
    const body = await readJson<Body>(request);
    const { workspace, user } = await currentSession();
    switch (body.action) {
      case "mark":
        return { post: await markPublished(workspace.id, user, id, body.publishedUrl) };
      case "set_url":
        return { post: await setPublishedUrl(workspace.id, id, body.publishedUrl) };
      case "unmark":
        return { post: await unmarkPublished(workspace.id, user, id) };
      default:
        fail(400, "bad_action", "Unknown publish action.");
    }
  });
}
