"use client";

import { useCallback, useSyncExternalStore } from "react";

export const POSTS_MOBILE_QUERY = "(max-width: 767px)";

/** False on the server and wherever matchMedia is unavailable (tests). */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (listener: () => void) => {
      if (typeof window === "undefined" || !window.matchMedia)
        return () => undefined;
      const list = window.matchMedia(query);
      list.addEventListener?.("change", listener);
      return () => list.removeEventListener?.("change", listener);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () =>
      typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? Boolean(window.matchMedia(query)?.matches)
        : false,
    () => false,
  );
}
