"use client";

import { useId, useMemo, useState } from "react";
import { ChevronDown, Users } from "lucide-react";

import {
  Avatar,
  AvatarGroup,
  Checkbox,
  cx,
  Popover,
} from "@/shared/peacock/ui";
import {
  MAX_SELECTED_PROFILES,
  useProfileSelection,
  type ProfileSelectionMember,
} from "@/shared/shell/profile-selection";
import { LinkedInGlyph, XGlyph } from "./accounts-footer";
import {
  matchesQuery,
  useRegisterCommandSource,
  type CommandSource,
} from "./command-registry";
import styles from "./shell.module.css";

type SelectableMember = ProfileSelectionMember & { profileId: string };

function hasProfile(member: ProfileSelectionMember): member is SelectableMember {
  return member.profileId !== undefined;
}

/** "Neel Majmudar" → "Neel M."; single names are kept whole. */
export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Unnamed";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
}

/** Trigger summary: "All accounts", one short name, or "3 accounts". */
export function selectionSummary(
  selected: readonly Pick<ProfileSelectionMember, "name">[],
  selectableCount: number,
  loading: boolean,
): string {
  if (loading) return "Accounts";
  if (selected.length === 0) return "No accounts";
  if (selected.length === 1) return shortName(selected[0].name);
  if (selected.length === selectableCount) return "All accounts";
  return `${selected.length} accounts`;
}

type Notice = { kind: "last"; name: string } | { kind: "max" } | null;

const LINKEDIN_TONE: Record<string, string | undefined> = {
  connected: styles.statusOk,
  reconnect_required: styles.statusWarn,
  error: styles.statusWarn,
  restricted: styles.statusWarn,
  disconnected: styles.statusWarn,
  connecting: styles.statusWarn,
};

function linkedInStatusText(member: ProfileSelectionMember): string {
  return member.health.status === "not_connected"
    ? "No LinkedIn account"
    : "LinkedIn added";
}

function xStatusText(member: ProfileSelectionMember): string {
  return member.xStatus === "connected" ? "X added" : "No X account";
}

function ConnectionIcons({
  member,
}: {
  member: ProfileSelectionMember;
}): React.JSX.Element {
  const linkedIn = linkedInStatusText(member);
  const x = xStatusText(member);
  return (
    <span className={styles.selectorStatus}>
      <span
        className={cx(
          styles.selectorStatusIcon,
          LINKEDIN_TONE[member.health.status] ?? styles.statusOff,
        )}
        title={linkedIn}
      >
        <LinkedInGlyph size={13} className={styles.selectorGlyph} />
      </span>
      <span
        className={cx(
          styles.selectorStatusIcon,
          member.xStatus === "connected"
            ? styles.statusOk
            : member.xStatus
              ? styles.statusWarn
              : styles.statusOff,
        )}
        title={x}
      >
        <XGlyph size={12} className={styles.selectorGlyph} />
      </span>
      <span className="sr-only">
        {linkedIn}, {x}
      </span>
    </span>
  );
}

/**
 * Top-bar account selector. It picks people (workspace members with a
 * profile); a person brings both their LinkedIn and X data, and every screen
 * aggregates whoever is selected. It drives `useProfileSelection`, which
 * remembers the choice per workspace in this browser.
 *
 * It only changes what screens show. It never chooses who posts or sends:
 * the composer and Messages ask for the exact account at the point of use.
 */
export function AccountSelector(): React.JSX.Element | null {
  const selection = useProfileSelection();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const noticeId = useId();
  const { members, selectedProfileIds, loading, hasScope } = selection;

  const selectable = useMemo(() => members.filter(hasProfile), [members]);
  const selected = useMemo(() => {
    const byProfile = new Map(selectable.map((m) => [m.profileId, m]));
    return selectedProfileIds.flatMap((id) => {
      const member = byProfile.get(id);
      return member ? [member] : [];
    });
  }, [selectable, selectedProfileIds]);
  const selectableCount = selectable.length;
  const bound = Math.min(selectableCount, MAX_SELECTED_PROFILES);
  const allSelected = selected.length > 0 && selected.length >= bound;
  const summary = selectionSummary(selected, selectableCount, loading);
  const selectAll = selection.selectAllProfiles;
  const selectOnly = selection.selectOnlyProfile;

  const commandSource = useMemo<CommandSource>(
    () => ({
      id: "shell-accounts",
      group: "Accounts",
      order: 30,
      useItems: (query) =>
        [
          {
            id: "choose-accounts",
            label: "Choose accounts",
            icon: <Users size={16} strokeWidth={1.75} />,
            keywords: ["switch", "people", "profiles", "members", "select"],
            // Wait for the palette to close and restore focus first.
            run: () => requestAnimationFrame(() => setOpen(true)),
          },
        ].filter((item) => matchesQuery(item, query)),
    }),
    [],
  );
  useRegisterCommandSource(commandSource);

  if (!hasScope) return null;

  function toggle(member: SelectableMember): void {
    const isOn = selection.isSelected(member.profileId);
    if (isOn && selected.length <= 1) {
      // The provider refuses to clear the last selection; say why.
      setNotice({ kind: "last", name: shortName(member.name) });
      return;
    }
    if (!isOn && selected.length >= MAX_SELECTED_PROFILES) {
      setNotice({ kind: "max" });
      return;
    }
    setNotice(null);
    selection.toggleProfile(member.profileId);
  }

  const noticeText =
    notice?.kind === "last"
      ? `${notice.name} is the only selected account. Select another account first; at least one stays selected.`
      : notice?.kind === "max"
        ? `Up to ${MAX_SELECTED_PROFILES} accounts can be selected at once. Clear one first.`
        : selected.length === 1 && selectableCount > 1
          ? "At least one account stays selected."
          : selectableCount > MAX_SELECTED_PROFILES
            ? `Up to ${MAX_SELECTED_PROFILES} accounts at once.`
            : "";

  return (
    <div className={styles.selectorRoot}>
      <Popover
        label="Accounts"
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setNotice(null);
        }}
        className={styles.selectorPanel}
        trigger={(props) => (
          <button
            type="button"
            {...props}
            className={styles.selectorButton}
            aria-label={`Accounts: ${summary}`}
          >
            {selected.length > 0 ? (
              <AvatarGroup
                people={selected.map((member) => ({
                  name: member.name,
                  ...(member.profilePictureUrl
                    ? { src: member.profilePictureUrl }
                    : {}),
                }))}
                size={24}
                max={3}
                className={styles.selectorAvatars}
              />
            ) : (
              <span className={styles.selectorEmptyIcon} aria-hidden>
                <Users size={16} strokeWidth={1.75} />
              </span>
            )}
            <span className={styles.selectorLabel}>{summary}</span>
            <ChevronDown
              size={14}
              strokeWidth={1.75}
              className={styles.selectorChevron}
              aria-hidden
            />
          </button>
        )}
      >
        <div className={styles.selectorHead}>
          <div className={styles.selectorHeadCopy}>
            <span className={styles.selectorTitle}>Accounts</span>
            <span className={styles.selectorHint}>
              Screens combine data for everyone selected.
            </span>
          </div>
          {selectAll && selectableCount > 1 ? (
            <button
              type="button"
              className={styles.selectorSelectAll}
              disabled={allSelected}
              onClick={() => {
                setNotice(null);
                selectAll();
              }}
            >
              {selectableCount > MAX_SELECTED_PROFILES
                ? `Select first ${MAX_SELECTED_PROFILES}`
                : "Select all"}
            </button>
          ) : null}
        </div>
        {loading && members.length === 0 ? (
          <p className={styles.selectorEmpty}>Loading accounts…</p>
        ) : members.length === 0 ? (
          <p className={styles.selectorEmpty}>
            No members in this workspace yet.
          </p>
        ) : (
          <ul className={styles.selectorList} aria-label="People">
            {members.map((member) => {
              const available = hasProfile(member);
              const checked =
                available && selection.isSelected(member.profileId);
              const reason = available
                ? undefined
                : (member.profileUnavailableReason ?? "Not available.");
              return (
                <li key={member.memberId} className={styles.selectorItem}>
                  <Checkbox
                    className={cx(
                      styles.selectorRow,
                      !available && styles.selectorRowDisabled,
                    )}
                    checked={checked}
                    disabled={!available}
                    aria-describedby={noticeText ? noticeId : undefined}
                    onCheckedChange={() => {
                      if (available) toggle(member);
                    }}
                    label={
                      <span className={styles.selectorRowBody}>
                        <Avatar
                          name={member.name}
                          size={24}
                          decorative
                          {...(member.profilePictureUrl
                            ? { src: member.profilePictureUrl }
                            : {})}
                        />
                        <span className={styles.selectorRowCopy}>
                          <span className={styles.selectorRowName}>
                            {member.name}
                          </span>
                          {reason ? (
                            <span className={styles.selectorRowReason}>
                              {reason}
                            </span>
                          ) : null}
                        </span>
                        <ConnectionIcons member={member} />
                      </span>
                    }
                  />
                  {available && selectOnly && selectableCount > 1 ? (
                    <button
                      type="button"
                      className={styles.selectorOnly}
                      aria-label={`Show only ${member.name}`}
                      aria-pressed={checked && selected.length === 1}
                      onClick={() => {
                        setNotice(null);
                        selectOnly(member.profileId);
                      }}
                    >
                      Only
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        <p
          id={noticeId}
          className={cx(
            styles.selectorNotice,
            notice && styles.selectorNoticeActive,
          )}
          role="status"
        >
          {noticeText}
        </p>
      </Popover>
    </div>
  );
}
