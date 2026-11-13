import { mediaExtension, mediaProblem } from "@/lib/media";
import { fail, handle } from "@/server/http";
import { currentWorkspace } from "@/server/session";
import { signUpload } from "@/server/storage";

export const dynamic = "force-dynamic";

/**
 * Step 1 of an upload. JSON { fileName, mimeType, sizeBytes } → { id, uploadUrl }.
 * The browser PUTs the file to uploadUrl, then POSTs { id, … } to /api/assets.
 */
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const body = (await request.json().catch(() => null)) as {
      fileName?: unknown;
      mimeType?: unknown;
      sizeBytes?: unknown;
    } | null;
    const fileName = typeof body?.fileName === "string" ? body.fileName : null;
    const mimeType = typeof body?.mimeType === "string" ? body.mimeType : null;
    const sizeBytes = typeof body?.sizeBytes === "number" ? body.sizeBytes : null;
    if (fileName === null || mimeType === null || sizeBytes === null) {
      fail(400, "bad_request", "Send fileName, mimeType and sizeBytes.");
    }
    const problem = mediaProblem({ name: fileName, type: mimeType, size: sizeBytes });
    if (problem) fail(400, "bad_file", problem);
    const ext = mediaExtension(mimeType);
    if (!ext) fail(400, "bad_type", `${fileName} isn't a supported image or video.`);

    const workspace = await currentWorkspace();
    const id = crypto.randomUUID();
    const uploadUrl = await signUpload(`${workspace.id}/${id}.${ext}`);
    return { id, uploadUrl };
  });
}
