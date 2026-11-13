"use client";

import Link from "next/link";
import { Unplug } from "lucide-react";

import {
  useProfileSelection,
  type ProfileSelectionMember,
} from "@/shared/shell/profile-selection";
import styles from "./shell.module.css";

export const MANAGE_ACCOUNTS_HREF = "/settings";

const NEEDS_RECONNECT = new Set([
  "reconnect_required",
  "disconnected",
  "error",
  "restricted",
]);

export type AccountsSummary = {
  connected: number;
  total: number;
  /** Members with at least one connected X account (lane E directory). */
  xConnected: number;
  needsReconnect: readonly ProfileSelectionMember[];
};

/** Saved member-directory data only; nothing here contacts a provider. */
export function summarizeAccounts(
  members: readonly ProfileSelectionMember[],
): AccountsSummary {
  return {
    connected: members.filter((m) => m.health.status === "connected").length,
    total: members.length,
    xConnected: members.filter((m) => m.xStatus === "connected").length,
    needsReconnect: members.filter((m) => NEEDS_RECONNECT.has(m.health.status)),
  };
}

export function XGlyph({
  size = 12,
  className = styles.linkedInGlyph,
}: {
  size?: number;
  className?: string;
}): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.21-6.82-5.97 6.82H1.67l7.73-8.84L1.25 2.25h6.83l4.71 6.23 5.45-6.23zm-1.16 17.52h1.83L7.08 4.13H5.12l11.96 15.64z" />
    </svg>
  );
}

export function reconnectMessage(
  needsReconnect: readonly ProfileSelectionMember[],
): string | null {
  if (needsReconnect.length === 0) return null;
  if (needsReconnect.length === 1) {
    const first = needsReconnect[0].name.trim().split(/\s+/)[0] || "A member";
    return `${first}'s LinkedIn needs reconnecting`;
  }
  return `${needsReconnect.length} LinkedIn accounts need reconnecting`;
}

export function LinkedInGlyph({
  size = 14,
  className = styles.linkedInGlyph,
}: {
  size?: number;
  className?: string;
}): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}

/**
 * Sidebar footer card (COMPONENTS.md › Sidebar › Footer card): LinkedIn
 * and X connections across the workspace plus a reconnect warning. X counts
 * come from `xStatus` in the member directory (lane E).
 */
export function AccountsFooter({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}): React.JSX.Element | null {
  const { members, loading, hasScope } = useProfileSelection();
  if (!hasScope) return null;
  const summary = summarizeAccounts(members);
  const warning = reconnectMessage(summary.needsReconnect);

  if (collapsed) {
    return (
      <>
        {warning ? (
          <Link
            href={MANAGE_ACCOUNTS_HREF}
            className={styles.footerWarningIcon}
            aria-label={warning}
            title={
              summary.needsReconnect.length === 1
                ? "1 account needs reconnecting"
                : `${summary.needsReconnect.length} accounts need reconnecting`
            }
            onClick={onNavigate}
          >
            <Unplug size={16} strokeWidth={1.75} aria-hidden />
          </Link>
        ) : null}
      </>
    );
  }

  return (
    <section className={styles.footerCard} aria-label="Accounts">
      <div className={styles.footerHead}>
        <span className={styles.footerTitle}>Accounts</span>
        <Link
          href={MANAGE_ACCOUNTS_HREF}
          className={styles.footerManage}
          onClick={onNavigate}
        >
          Manage
        </Link>
      </div>
      <div className={styles.footerRow}>
        <LinkedInGlyph />
        <span className={styles.footerRowName}>LinkedIn</span>
        <span className={styles.footerRowCount}>
          {loading ? "—" : `${summary.connected} of ${summary.total}`}
        </span>
      </div>
      <div className={styles.footerRow}>
        <XGlyph />
        <span className={styles.footerRowName}>X</span>
        <span className={styles.footerRowCount}>
          {loading ? "—" : `${summary.xConnected} of ${summary.total}`}
        </span>
      </div>
      {warning ? (
        <Link
          href={MANAGE_ACCOUNTS_HREF}
          className={styles.footerWarning}
          onClick={onNavigate}
        >
          <Unplug size={13} strokeWidth={1.75} aria-hidden />
          {warning}
        </Link>
      ) : null}
    </section>
  );
}
