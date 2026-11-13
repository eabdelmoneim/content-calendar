"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  DARK_MEDIA_QUERY,
  DEFAULT_THEME_PREFERENCE,
  isThemePreference,
  resolveTheme,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemePreference,
} from "./theme";

const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function systemPrefersDark(): boolean {
  try {
    return window.matchMedia(DARK_MEDIA_QUERY).matches;
  } catch {
    return false;
  }
}

export function readThemePreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : DEFAULT_THEME_PREFERENCE;
  } catch {
    return DEFAULT_THEME_PREFERENCE;
  }
}

function applyTheme(preference: ThemePreference): ResolvedTheme {
  const resolved = resolveTheme(preference, systemPrefersDark());
  document.documentElement.setAttribute("data-theme", resolved);
  return resolved;
}

/** Saves the preference (best effort) and updates `<html data-theme>` now. */
export function setTheme(preference: ThemePreference): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Storage can be unavailable (private mode, blocked site data); the
    // attribute still updates for this page view.
  }
  applyTheme(preference);
  notify();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent): void => {
    if (event.key !== THEME_STORAGE_KEY) return;
    applyTheme(readThemePreference());
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getServerSnapshot(): ThemePreference {
  return DEFAULT_THEME_PREFERENCE;
}

export type UseThemeResult = {
  readonly preference: ThemePreference;
  readonly resolved: ResolvedTheme;
  readonly setTheme: (preference: ThemePreference) => void;
};

export function useTheme(): UseThemeResult {
  const preference = useSyncExternalStore(
    subscribe,
    readThemePreference,
    getServerSnapshot,
  );
  const resolved = useSyncExternalStore(
    subscribe,
    () => resolveTheme(readThemePreference(), systemPrefersDark()),
    () => resolveTheme(DEFAULT_THEME_PREFERENCE, false),
  );

  // Follow OS changes while the preference is "system".
  useEffect(() => {
    if (preference !== "system") return;
    let query: MediaQueryList;
    try {
      query = window.matchMedia(DARK_MEDIA_QUERY);
    } catch {
      return;
    }
    const onChange = (): void => {
      applyTheme("system");
      notify();
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [preference]);

  const set = useCallback((next: ThemePreference) => setTheme(next), []);
  return { preference, resolved, setTheme: set };
}
