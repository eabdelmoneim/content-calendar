/**
 * Peacock theme preference. The chosen preference is stored in localStorage and
 * resolved to `<html data-theme="light|dark">`, which `shared/styles/tokens.css`
 * keys its dark set on.
 *
 * This module has no client directive so the root layout (a Server Component)
 * can embed `THEME_INIT_SCRIPT`.
 */

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "peacock-theme";
export const DEFAULT_THEME_PREFERENCE: ThemePreference = "light";
export const DARK_MEDIA_QUERY = "(prefers-color-scheme: dark)";

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference === "system") return systemPrefersDark ? "dark" : "light";
  return preference;
}

/**
 * Runs inline in `<head>` before first paint so the page never flashes the
 * wrong theme. Kept dependency-free and in sync with `resolveTheme`.
 */
export const THEME_INIT_SCRIPT = `(function(){var d=document.documentElement,t="light";try{var p=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(p==="dark"){t="dark"}else if(p==="system"&&window.matchMedia(${JSON.stringify(
  DARK_MEDIA_QUERY,
)}).matches){t="dark"}}catch(e){}d.setAttribute("data-theme",t)})();`;
