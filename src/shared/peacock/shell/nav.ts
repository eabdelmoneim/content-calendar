import {
  CalendarDays,
  ChartNoAxesColumn,
  Images,
  Settings,
  type LucideIcon,
} from "lucide-react";

/** Canonical app routes (IMPLEMENTATION_PLAN.md decision 7). */
export const ROUTES = {
  posts: "/posts",
  analytics: "/analytics",
  assets: "/assets",
  settings: "/settings",
} as const;

export type NavId = "posts" | "analytics" | "assets" | "settings";

export type NavItem = {
  id: NavId;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Uppercase "New" badge (COMPONENTS.md › Sidebar). */
  badge?: string;
};

export type NavGroup = {
  id: "general" | "workspace" | "admin";
  label: string;
  items: readonly NavItem[];
  /** Rendered only for global admins. */
  adminOnly?: boolean;
};

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    id: "general",
    label: "General",
    items: [
      { id: "posts", label: "Posts", href: ROUTES.posts, icon: CalendarDays },
      {
        id: "analytics",
        label: "Analytics",
        href: ROUTES.analytics,
        icon: ChartNoAxesColumn,
      },
      { id: "assets", label: "Assets", href: ROUTES.assets, icon: Images },
    ],
  },
  {
    id: "workspace",
    label: "Workspace",
    items: [
      {
        id: "settings",
        label: "Settings",
        href: ROUTES.settings,
        icon: Settings,
      },
    ],
  },
];

export function visibleNavGroups(isGlobalAdmin: boolean): readonly NavGroup[] {
  return NAV_GROUPS.filter((group) => !group.adminOnly || isGlobalAdmin).map(
    (group) => group,
  );
}

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function activeNavItem(pathname: string): NavItem | undefined {
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (isActivePath(pathname, item.href)) return item;
    }
  }
  return undefined;
}

export type ShellTitle = {
  title: string;
  /** Optional breadcrumb parent shown before the title. */
  parent?: { label: string; href: string };
};

/** Top-bar title for a route; screens may override it with useShellTitle. */
export function titleForPath(pathname: string): ShellTitle {
  const item = activeNavItem(pathname);
  if (!item) return { title: "" };
  return { title: item.label };
}
