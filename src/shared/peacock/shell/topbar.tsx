"use client";

import Link from "next/link";
import { ChevronRight, Menu } from "lucide-react";

import { IconButton } from "@/shared/peacock/ui";
import { AccountSelector } from "./account-selector";
import type { ShellTitle } from "./nav";
import styles from "./shell.module.css";

export type TopbarProps = ShellTitle & {
  /** Opens the mobile navigation drawer (shown below 768px). */
  onOpenMenu: () => void;
  menuOpen: boolean;
  menuControls: string;
};

/**
 * COMPONENTS.md › Topbar · Topbar.dc.html. The left slot holds the account
 * selector (which people every screen shows); the signed-in person's menu
 * lives at the bottom of the sidebar.
 */
export function Topbar({
  title,
  parent,
  onOpenMenu,
  menuOpen,
  menuControls,
}: TopbarProps): React.JSX.Element {
  return (
    <header className={styles.topbar}>
      <IconButton
        aria-label="Open navigation"
        aria-expanded={menuOpen}
        aria-controls={menuControls}
        className={styles.menuButton}
        icon={<Menu size={20} strokeWidth={1.75} />}
        onClick={onOpenMenu}
      />
      <AccountSelector />
      <span className={styles.topbarDivider} aria-hidden />
      <div className={styles.titleRow}>
        {parent ? (
          <>
            <Link href={parent.href} className={styles.breadcrumb}>
              {parent.label}
            </Link>
            <ChevronRight
              size={14}
              strokeWidth={1.75}
              className={styles.breadcrumbChevron}
              aria-hidden
            />
          </>
        ) : null}
        {/* Page h1s still live in each screen; this is the shell title. */}
        <span className={styles.title}>{title}</span>
      </div>
    </header>
  );
}
