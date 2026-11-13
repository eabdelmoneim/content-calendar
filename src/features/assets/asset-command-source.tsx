"use client";

import { Image as ImageIcon } from "lucide-react";
import { useMemo } from "react";

import { useAssets } from "@/lib/api";
import {
  useRegisterCommandSource,
  type CommandItem,
  type CommandSource,
} from "@/shared/peacock/shell/command-registry";

import { assetHref } from "./asset-presentation";

export const ASSET_COMMAND_SOURCE_ID = "assets";
const PALETTE_RESULTS = 8;

/** Saved-data search over the library by file name; runs only for a non-empty query. */
function useAssetCommandItems(query: string): readonly CommandItem[] {
  const search = query.trim().toLowerCase();
  const assets = useAssets();
  return useMemo(
    () =>
      search.length === 0 || !assets.data
        ? []
        : assets.data
            .filter((asset) => asset.fileName.toLowerCase().includes(search))
            .slice(0, PALETTE_RESULTS)
            .map((asset) => ({
              id: asset.id,
              label: asset.fileName,
              icon: <ImageIcon size={15} strokeWidth={1.75} aria-hidden />,
              keywords: [search],
              href: assetHref(asset.id),
            })),
    [assets.data, search],
  );
}

const ASSET_COMMAND_SOURCE: CommandSource = {
  id: ASSET_COMMAND_SOURCE_ID,
  group: "Assets",
  order: 60,
  useItems: (query) => useAssetCommandItems(query),
};

/** ⌘K "Assets" group while the caller is mounted. Mount it app-wide to search from any screen. */
export function useAssetCommandSource(): void {
  useRegisterCommandSource(ASSET_COMMAND_SOURCE);
}
