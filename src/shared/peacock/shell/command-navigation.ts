import type { LucideIcon } from "lucide-react";

import { ROUTES, visibleNavGroups } from "./nav";

/** Deep link the Posts screen picks up to open the composer. */
export const NEW_POST_HREF = `${ROUTES.posts}?compose=new`;

export type NavigationCommand = {
  id: string;
  label: string;
  href: string;
  Icon: LucideIcon;
  shortcut?: string[];
  keywords?: string[];
};

/** The ⌘K "Go to" entries: every visible nav item. */
export function navigationCommands(isGlobalAdmin: boolean): NavigationCommand[] {
  return visibleNavGroups(isGlobalAdmin).flatMap((group) =>
    group.items.map((item) => ({ id: item.id, label: item.label, href: item.href, Icon: item.icon })),
  );
}
