"use client";

import Link from "next/link";
import { forwardRef } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { cx, IconButton, Tooltip } from "@/shared/peacock/ui";
import { AccountMenu } from "./account-menu";
import { AccountsFooter } from "./accounts-footer";
import { isActivePath, visibleNavGroups } from "./nav";
import { WorkspaceSwitcher } from "./workspace-switcher";
import styles from "./shell.module.css";

export type SidebarProps = {
  pathname: string;
  collapsed: boolean;
  isGlobalAdmin: boolean;
  onToggleCollapsed: () => void;
  /** Mobile layout: the sidebar is a drawer and never collapses. */
  mobile?: boolean;
  /** Mobile drawer state; ignored on desktop. */
  drawerOpen?: boolean;
  onNavigate?: () => void;
  id?: string;
};

/** COMPONENTS.md › Sidebar · Sidebar.dc.html */
export const Sidebar = forwardRef<HTMLElement, SidebarProps>(function Sidebar(
  {
    pathname,
    collapsed,
    isGlobalAdmin,
    onToggleCollapsed,
    mobile = false,
    drawerOpen = false,
    onNavigate,
    id,
  },
  ref,
) {
  const groups = visibleNavGroups(isGlobalAdmin);
  return (
    <nav
      ref={ref}
      id={id}
      aria-label="Main"
      className={cx(
        styles.sidebar,
        collapsed && styles.sidebarCollapsed,
        drawerOpen && styles.sidebarDrawerOpen,
      )}
      data-collapsed={collapsed || undefined}
    >
      <div className={styles.sidebarHeader}>
        <WorkspaceSwitcher collapsed={collapsed} />
        {collapsed || mobile ? null : (
          <Tooltip content="Collapse sidebar  [" side="bottom">
            <IconButton
              aria-label="Collapse sidebar"
              aria-keyshortcuts="["
              size="sm"
              variant="secondary"
              className={styles.collapseButton}
              icon={<PanelLeftClose size={15} strokeWidth={1.75} />}
              onClick={onToggleCollapsed}
            />
          </Tooltip>
        )}
      </div>
      {collapsed && !mobile ? (
        // The rail keeps the toggle at the top: a row stacked directly under
        // the 56px header (which stays aligned with the top bar's border).
        // Native title: a centred Tooltip would overflow the 72px rail.
        <div className={styles.railToggle}>
          <IconButton
            aria-label="Expand sidebar"
            aria-keyshortcuts="["
            title="Expand sidebar  ["
            size="sm"
            variant="secondary"
            className={cx(styles.collapseButton, styles.railExpand)}
            icon={<PanelLeftOpen size={15} strokeWidth={1.75} />}
            onClick={onToggleCollapsed}
          />
        </div>
      ) : null}

      <div className={styles.navScroll}>
        {groups.map((group) => (
          <div
            key={group.id}
            role="group"
            aria-label={group.label}
            className={styles.navGroup}
          >
            {collapsed ? null : (
              <div className={styles.navGroupLabel} aria-hidden>
                {group.label}
              </div>
            )}
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = isActivePath(pathname, item.href);
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={cx(styles.navItem, active && styles.navItemActive)}
                  aria-current={active ? "page" : undefined}
                  aria-label={collapsed ? item.label : undefined}
                  title={collapsed ? item.label : undefined}
                  onClick={onNavigate}
                >
                  <Icon
                    size={20}
                    strokeWidth={1.75}
                    className={styles.navIcon}
                    aria-hidden
                  />
                  {collapsed ? null : (
                    <span className={styles.navLabel}>{item.label}</span>
                  )}
                  {item.badge && !collapsed ? (
                    <span className={styles.newBadge}>{item.badge}</span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      <div
        className={cx(
          styles.sidebarFooter,
          collapsed && styles.sidebarFooterCollapsed,
        )}
      >
        <AccountsFooter collapsed={collapsed} onNavigate={onNavigate} />
        <AccountMenu collapsed={collapsed} onNavigate={onNavigate} />
      </div>
    </nav>
  );
});
