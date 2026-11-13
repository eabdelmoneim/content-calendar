import { attachmentContentDisposition } from "@/features/assets/download-name";
import { handle } from "@/server/http";
import { assetStoragePath } from "@/server/repo";
import { currentWorkspace } from "@/server/session";
import { getObject } from "@/server/storage";

type Context = { params: Promise<{ id: string }> };

/**
 * Streams the file from the private bucket. ?download=1 saves it as a file.
 * Range requests pass through so browsers can seek and play video.
 */
export async function GET(request: Request, { params }: Context): Promise<Response> {
  return handle(async () => {
    const { id } = await params;
    const workspace = await currentWorkspace();
    const asset = await assetStoragePath(workspace.id, id);
    const range = request.headers.get("range");
    const upstream = await getObject(asset.path, range);
    if (!upstream.ok || !upstream.body) {
      throw new Error(`Storage read failed (${upstream.status}) for asset ${id}`);
    }
    const download = new URL(request.url).searchParams.get("download") === "1";
    const passthrough: Record<string, string> = {};
    for (const name of ["content-length", "content-range", "accept-ranges"]) {
      const value = upstream.headers.get(name);
      if (value) passthrough[name] = value;
    }
    return new Response(upstream.body, {
      status: upstream.status === 206 ? 206 : 200,
      headers: {
        ...passthrough,
        "Content-Type": asset.mimeType,
        "Cache-Control": "private, max-age=3600",
        ...(download
          ? { "Content-Disposition": attachmentContentDisposition(asset.fileName, asset.mimeType) }
          : {}),
      },
    });
  });
}
