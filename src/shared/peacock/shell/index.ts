/**
 * Peacock app shell (Phase 1b): Sidebar + Topbar + ⌘K palette + mobile drawer.
 * Screen search sources register with `useRegisterCommandSource` once for
 * every (app) route (see app/(app)/global-command-sources.tsx); screens may
 * override the Topbar title with `useShellTitle` and use the shell's single
 * toast queue through `useToast`.
 */
export { AccountMenu } from "./account-menu";
export { AccountSelector } from "./account-selector";
export { AppShell } from "./app-shell";
export type { AppShellProps } from "./app-shell";
export {
  BUILT_IN_COMMAND_SOURCES,
  CommandPalette,
  NEW_POST_HREF,
} from "./command-palette";
export {
  isOutboundCommand,
  MAX_ITEMS_PER_GROUP,
  matchesQuery,
  registerCommandSource,
  useRegisterCommandSource,
} from "./command-registry";
export type {
  CommandContext,
  CommandItem,
  CommandSource,
} from "./command-registry";
export { NAV_GROUPS, ROUTES, titleForPath, visibleNavGroups } from "./nav";
export type { NavGroup, NavId, NavItem, ShellTitle } from "./nav";
export { PreferencesProvider, usePreferences } from "./preferences";
export { useShellPane, useShellTitle } from "./shell-title";
export { Sidebar } from "./sidebar";
export { Topbar } from "./topbar";
