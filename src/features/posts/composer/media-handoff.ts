"use client";

/**
 * X's and LinkedIn's share links carry text only; neither platform lets a link
 * attach media. So "Post on X/LinkedIn" hands the media over the two ways a
 * browser can: the first image goes on the clipboard (paste it into the
 * composer), and every attachment is downloaded (drag it in). Both run inside
 * the click, which browsers require for clipboard writes and downloads.
 */
import { mediaKind } from "@/lib/media";
import type { Asset } from "@/lib/types";

export type MediaHandoff = { copiedImage: Asset | null; downloaded: readonly Asset[] };

/** Clipboards only take PNG reliably, so other images are redrawn as PNG. */
async function pngBlob(asset: Asset): Promise<Blob> {
  const resp = await fetch(asset.url);
  if (!resp.ok) throw new Error(`Could not load ${asset.fileName} (${resp.status}).`);
  const blob = await resp.blob();
  if (blob.type === "image/png") return blob;
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser can't convert the image for the clipboard.");
  context.drawImage(bitmap, 0, 0);
  return new Promise((resolve, reject) =>
    canvas.toBlob((png) => (png ? resolve(png) : reject(new Error("Image conversion failed."))), "image/png"),
  );
}

function download(asset: Asset): void {
  const link = document.createElement("a");
  link.href = `${asset.url}?download=1`;
  link.download = asset.fileName;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
}

/** Must be called synchronously from the click handler. */
export async function handOffMedia(assets: readonly Asset[]): Promise<MediaHandoff> {
  if (assets.length === 0) return { copiedImage: null, downloaded: [] };
  const firstImage = assets.find((asset) => mediaKind(asset.mimeType) === "image") ?? null;
  // Start the clipboard write before any await so it stays inside the click.
  const copying =
    firstImage && typeof ClipboardItem !== "undefined" && navigator.clipboard?.write
      ? navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob(firstImage) })]).then(
          () => true,
          (error: unknown) => {
            console.warn("[content-calendar] clipboard copy failed", error);
            return false;
          },
        )
      : Promise.resolve(false);
  assets.forEach(download);
  return { copiedImage: (await copying) ? firstImage : null, downloaded: assets };
}

/** What to tell the person after the composer opens. */
export function handoffMessage(platform: string, handoff: MediaHandoff): string | null {
  const { copiedImage, downloaded } = handoff;
  if (downloaded.length === 0) return null;
  const names = downloaded.map((asset) => asset.fileName).join(", ");
  const files = downloaded.length === 1 ? "it" : "them";
  const pasted = copiedImage ? `${copiedImage.fileName} is on your clipboard: paste it into the ${platform} composer (⌘V / Ctrl+V). ` : "";
  return `${pasted}Downloaded ${names}. If anything is missing from the post, drag ${files} from your Downloads into the ${platform} composer before pressing Post.`;
}
