"use client";

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";

import { useWorkspaceAccess } from "@/shared/auth/workspace-access";
import { cx, ToastProvider } from "@/shared/peacock/ui";
import { ProfileSelectionProvider } from "@/shared/shell/profile-selection";
import {
  CommandPalette,
  NEW_POST_HREF,
} from "./command-palette";
import { titleForPath } from "./nav";
import {
  readLocal,
  SIDEBAR_COLLAPSED_KEY,
  usePreferences,
  writeLocal,
} from "./preferences";
import {
  ShellTitleProvider,
  useShellPaneLayout,
  useShellTitleOverride,
} from "./shell-title";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import styles from "./shell.module.css";

export const MOBILE_QUERY = "(max-width: 767px)";
export const NARROW_QUERY = "(max-width: 1023px)";

function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (listener: () => void) => {
      let list: MediaQueryList;
      try {
        list = window.matchMedia(query);
      } catch {
        return () => {};
      }
      list.addEventListener("change", listener);
      return () => list.removeEventListener("change", listener);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => {
      try {
        return window.matchMedia(query).matches;
      } catch {
        return false;
      }
    },
    () => false,
  );
}

function readCollapsed(): boolean | null {
  const stored = readLocal(SIDEBAR_COLLAPSED_KEY);
  return stored === "true" ? true : stored === "false" ? false : null;
}

/** Typing contexts where single-key shortcuts must not fire. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.getAttribute("role") === "textbox" ||
    target.getAttribute("role") === "combobox"
  );
}

function modalIsOpen(): boolean {
  return document.querySelector('dialog[open], [aria-modal="true"]') !== null;
}

export type AppShellProps = { children: ReactNode };

/**
 * Peacock app shell (COMPONENTS.md › AppShell): Sidebar, then a column with
 * the Topbar and a scrolling <main>, plus the global ⌘K palette and the one
 * toast queue every screen shares (`useToast`).
 *
 * The top bar's account selector drives the shared profile selection that
 * every screen reads and aggregates (ProfileSelectionProvider remembers it
 * per workspace in this browser). The signed-in person's menu sits at the
 * bottom of the sidebar.
 */
export function AppShell({ children }: AppShellProps): React.JSX.Element {
  return (
    <ProfileSelectionProvider>
      <ShellTitleProvider>
        <ToastProvider>
          <ShellFrame>{children}</ShellFrame>
        </ToastProvider>
      </ShellTitleProvider>
    </ProfileSelectionProvider>
  );
}

function ShellFrame({ children }: AppShellProps): React.JSX.Element {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const access = useWorkspaceAccess();
  const isGlobalAdmin = access?.isAdmin ?? false;
  const preferences = usePreferences();
  const mobile = useMediaQuery(MOBILE_QUERY);
  const narrow = useMediaQuery(NARROW_QUERY);
  const [localCollapsed, setLocalCollapsed] = useState<boolean | null>(
    readCollapsed,
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const sidebarId = useId();
  const titleOverride = useShellTitleOverride();
  const pane = useShellPaneLayout();
  const shellTitle = titleOverride ?? titleForPath(pathname);

  // Explicit choice (this browser, then the account), else collapse below
  // 1024px. The mobile drawer always shows the full sidebar.
  const preferredCollapsed =
    localCollapsed ?? preferences.server?.sidebarCollapsed ?? narrow;
  const collapsed = mobile ? false : preferredCollapsed;

  const toggleCollapsed = useCallback(() => {
    const next = !preferredCollapsed;
    setLocalCollapsed(next);
    writeLocal(SIDEBAR_COLLAPSED_KEY, String(next));
    preferences.save({ sidebarCollapsed: next });
  }, [preferredCollapsed, preferences]);

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    if ((event.metaKey || event.ctrlKey) && !event.altKey && key === "k") {
      event.preventDefault();
      setPaletteOpen((open) => !open);
      return;
    }
    if (event.key === "Escape" && drawerOpen) {
      setDrawerOpen(false);
      return;
    }
    if (
      event.defaultPrevented ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      paletteOpen ||
      isTypingTarget(event.target) ||
      modalIsOpen()
    ) {
      return;
    }
    if (event.key === "[" && !mobile) {
      event.preventDefault();
      toggleCollapsed();
    } else if (key === "c" && !event.shiftKey) {
      event.preventDefault();
      router.push(NEW_POST_HREF);
    }
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKeyDown(event);
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, []);

  // Move focus into the drawer when it opens on mobile.
  useEffect(() => {
    if (!drawerOpen) return;
    sidebarRef.current
      ?.querySelector<HTMLElement>("a[href], button:not([disabled])")
      ?.focus();
  }, [drawerOpen]);

  return (
    <div
      className={cx(
        "peacock",
        styles.shell,
        collapsed && styles.shellCollapsed,
      )}
    >
      {drawerOpen && mobile ? (
        <button
          type="button"
          className={styles.drawerOverlay}
          aria-label="Close navigation"
          onClick={() => setDrawerOpen(false)}
        />
      ) : null}
      <Sidebar
        ref={sidebarRef}
        id={sidebarId}
        pathname={pathname}
        collapsed={collapsed}
        isGlobalAdmin={isGlobalAdmin}
        onToggleCollapsed={toggleCollapsed}
        mobile={mobile}
        drawerOpen={drawerOpen && mobile}
        onNavigate={() => setDrawerOpen(false)}
      />
      <div className={styles.column} inert={drawerOpen && mobile}>
        <Topbar
          title={shellTitle.title}
          {...(shellTitle.parent ? { parent: shellTitle.parent } : {})}
          onOpenMenu={() => setDrawerOpen(true)}
          menuOpen={drawerOpen}
          menuControls={sidebarId}
        />
        <main className={cx(styles.main, pane && styles.mainPane)}>
          {children}
        </main>
      </div>
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        isGlobalAdmin={isGlobalAdmin}
      />
    </div>
  );
}
