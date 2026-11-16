"use client";

import { useEffect } from "react";
import { installNativeEditing } from "./native-editing";

/**
 * Mounts the copy/paste bridge once for the whole app, so every input, textarea
 * and rich-text field in it gets the shortcuts whether or not the host forwards
 * them. See native-editing.ts for why this exists.
 */
export function useNativeEditing(): void {
  useEffect(() => installNativeEditing(document), []);
}
