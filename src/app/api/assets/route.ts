import { mediaExtension, mediaProblem } from "@/lib/media";
import { fail, handle } from "@/server/http";
import { insertAsset, listAssets } from "@/server/repo";
import { currentSession, currentWorkspace } from "@/server/session";
import { objectInfo, removeObject } from "@/server/storage";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function GET(): Promise<Response> {
  return handle(async () => {
    const workspace = await currentWorkspace();
    return { assets: await listAssets(workspace.id) };
  });
}

/**
 * Step 2 of an upload (step 1 is POST /api/assets/uploads). JSON
 * { id, fileName, mimeType, width, height }: checks what actually landed in
 * storage, then records the asset. A file that breaks the rules is deleted.
 */
export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const body = (await request.json().catch(() => null)) as {
      id?: unknown;
      fileName?: unknown;
      mimeType?: unknown;
      width?: unknown;
      height?: unknown;
    } | null;
    const id = typeof body?.id === "string" && UUID.test(body.id) ? body.id : null;
    const fileName = typeof body?.fileName === "string" ? body.fileName : null;
    const mimeType = typeof body?.mimeType === "string" ? body.mimeType : null;
    if (id === null || fileName === null || mimeType === null) {
      fail(400, "bad_request", "Send the upload id, fileName and mimeType.");
    }
    const ext = mediaExtension(mimeType);
    if (!ext) fail(400, "bad_type", `${fileName} isn't a supported image or video.`);
    const width = typeof body?.width === "number" && body.width > 0 ? body.width : null;
    const height = typeof body?.height === "number" && body.height > 0 ? body.height : null;

    const { workspace, user } = await currentSession();
    const storagePath = `${workspace.id}/${id}.${ext}`;
    const stored = await objectInfo(storagePath);
    if (stored === null) fail(400, "upload_missing", `${fileName} didn't finish uploading. Try again.`);
    const problem =
      stored.contentType === mimeType
        ? mediaProblem({ name: fileName, type: mimeType, size: stored.size })
        : `${fileName} was stored as ${stored.contentType}, not ${mimeType}.`;
    if (problem) {
      await removeObject(storagePath);
      fail(400, "bad_file", problem);
    }
    try {
      const asset = await insertAsset(workspace.id, {
        id,
        storagePath,
        fileName,
        mimeType,
        sizeBytes: stored.size,
        width,
        height,
        createdByName: user.name,
      });
      return { asset };
    } catch (error) {
      await removeObject(storagePath);
      throw error;
    }
  });
}
