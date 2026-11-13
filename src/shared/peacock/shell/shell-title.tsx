"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type { ShellTitle } from "./nav";

type ShellChromeState = {
  override: ShellTitle | null;
  setOverride: Dispatch<SetStateAction<ShellTitle | null>>;
  pane: boolean;
  setPane: Dispatch<SetStateAction<boolean>>;
};

const ShellChromeContext = createContext<ShellChromeState | null>(null);

export function ShellTitleProvider({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  const [override, setOverride] = useState<ShellTitle | null>(null);
  const [pane, setPane] = useState(false);
  return (
    <ShellChromeContext.Provider
      value={{ override, setOverride, pane, setPane }}
    >
      {children}
    </ShellChromeContext.Provider>
  );
}

export function useShellTitleOverride(): ShellTitle | null {
  return useContext(ShellChromeContext)?.override ?? null;
}

export function useShellPaneLayout(): boolean {
  return useContext(ShellChromeContext)?.pane ?? false;
}

/**
 * Lets a screen replace the route title in the Topbar, e.g. a breadcrumb
 * "Posts › Edit post". Cleared when the screen unmounts.
 */
export function useShellTitle(
  title: string,
  parent?: { label: string; href: string },
): void {
  const setOverride = useContext(ShellChromeContext)?.setOverride;
  const parentLabel = parent?.label;
  const parentHref = parent?.href;
  useEffect(() => {
    if (!setOverride) return;
    setOverride({
      title,
      ...(parentLabel !== undefined && parentHref !== undefined
        ? { parent: { label: parentLabel, href: parentHref } }
        : {}),
    });
    return () => setOverride(null);
  }, [setOverride, title, parentLabel, parentHref]);
}

/**
 * Full-height pane screens (Messages, Composer) call this to drop the canvas
 * page padding and use the white `--bg` canvas (DESIGN.md › Layout).
 */
export function useShellPane(): void {
  const setPane = useContext(ShellChromeContext)?.setPane;
  useEffect(() => {
    if (!setPane) return;
    setPane(true);
    return () => setPane(false);
  }, [setPane]);
}
