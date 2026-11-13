"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { keys, uploadAsset } from "@/lib/api";
import type { Asset } from "@/lib/types";

import { fileProblem } from "./asset-presentation";

const UPLOAD_CONCURRENCY = 3;

export type UploadPhase = "uploading" | "failed";

/** A file between "chosen" and "in the library". */
export type UploadEntry = {
  id: string;
  name: string;
  phase: UploadPhase;
  progress: number;
  error?: string;
};

/**
 * Validates and uploads files, at most three in flight. Finished entries drop
 * out once the library query has the new asset; failures stay until dismissed.
 * (Each upload is sign → PUT to storage → record; see uploadAsset.)
 */
export function useAssetUploads(): {
  uploads: readonly UploadEntry[];
  batchError: string | null;
  start: (files: File[]) => Promise<Asset[]>;
  dismiss: (id: string) => void;
  clearBatchError: () => void;
} {
  const client = useQueryClient();
  const [uploads, setUploads] = useState<UploadEntry[]>([]);
  const [batchError, setBatchError] = useState<string | null>(null);

  const update = useCallback((id: string, patch: Partial<Omit<UploadEntry, "id">>) => {
    setUploads((current) => current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  }, []);

  const dismiss = useCallback((id: string) => {
    setUploads((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const start = useCallback(
    async (chosen: File[]): Promise<Asset[]> => {
      const problems = chosen.map(fileProblem).filter((p): p is string => p !== null);
      const files = chosen.filter((file) => fileProblem(file) === null);
      setBatchError(
        problems.length === 0
          ? null
          : problems.length === 1
            ? problems[0]!
            : `${problems.length} files were skipped: ${problems.join(" ")}`,
      );
      if (files.length === 0) return [];
      const batchId = crypto.randomUUID();
      const entries: UploadEntry[] = files.map((file, index) => ({
        id: `${batchId}-${index}`,
        name: file.name,
        phase: "uploading",
        progress: 0,
      }));
      setUploads((current) => [...entries, ...current]);
      const done: Asset[] = [];

      async function processFile(file: File, id: string): Promise<void> {
        try {
          const asset = await uploadAsset(file, (progress) => update(id, { progress }));
          update(id, { progress: 100 });
          done.push(asset);
          await client.invalidateQueries({ queryKey: keys.assets });
          dismiss(id);
        } catch (error) {
          update(id, {
            phase: "failed",
            error: error instanceof Error ? error.message : "This file could not be uploaded. Try again.",
          });
        }
      }

      let cursor = 0;
      await Promise.all(
        Array.from({ length: Math.min(UPLOAD_CONCURRENCY, files.length) }, async () => {
          while (cursor < files.length) {
            const index = cursor;
            cursor += 1;
            const file = files[index];
            const entry = entries[index];
            if (file && entry) await processFile(file, entry.id);
          }
        }),
      );
      return done;
    },
    [client, dismiss, update],
  );

  return { uploads, batchError, start, dismiss, clearBatchError: () => setBatchError(null) };
}
