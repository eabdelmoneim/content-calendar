"use client";

/**
 * Shell preferences (sidebar collapsed, theme). Peacock synced these to the
 * account; here they live in this browser only.
 */
export const SIDEBAR_COLLAPSED_KEY = "content-calendar-sidebar-collapsed";

export function readLocal(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeLocal(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}

export type PreferencesPatch = { sidebarCollapsed?: boolean; theme?: string };

export function usePreferences(): {
  server: { sidebarCollapsed?: boolean } | undefined;
  save: (patch: PreferencesPatch) => void;
} {
  return { server: undefined, save: () => {} };
}

export function PreferencesProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <>{children}</>;
}
