"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Check,
  ChevronsUpDown,
  Monitor,
  Moon,
  Sun,
  User,
} from "lucide-react";

import { useWorkspaceActor } from "@/shared/auth/workspace-access";
import { Avatar, cx, Popover, PopoverMenuItem } from "@/shared/peacock/ui";
import { useTheme, type ThemePreference } from "@/shared/theme";
import { usePreferences } from "./preferences";
import styles from "./shell.module.css";

const THEME_OPTIONS: ReadonlyArray<{
  value: ThemePreference;
  label: string;
  Icon: typeof Sun;
}> = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

/**
 * Signed-in person's menu (profile, theme, sign out). It is the last item in
 * the sidebar footer, below Connected accounts, and opens upward (sideways
 * from the collapsed rail) so the bottom of the viewport never clips it.
 */
export function AccountMenu({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}): React.JSX.Element {
  const actor = useWorkspaceActor();
  const router = useRouter();
  const { preference, setTheme } = useTheme();
  const preferences = usePreferences();
  const [open, setOpen] = useState(false);
  const role = actor.organizationName;
  const accessibleName = `Account menu: ${actor.name}, ${role}`;

  function chooseTheme(next: ThemePreference): void {
    setTheme(next);
    preferences.save({ theme: next });
  }

  return (
    <div
      className={cx(
        styles.accountMenu,
        collapsed && styles.accountMenuCollapsed,
      )}
    >
      <Popover
        role="menu"
        label="Account"
        open={open}
        onOpenChange={setOpen}
        className={styles.accountPanel}
        trigger={(props) => (
          <button
            type="button"
            {...props}
            className={styles.accountButton}
            aria-label={accessibleName}
            // Native title: a centred Tooltip would overflow the 72px rail.
            title={collapsed ? `${actor.name} · ${role}` : undefined}
          >
            <Avatar name={actor.name} size={32} decorative {...(actor.avatarUrl ? { src: actor.avatarUrl } : {})} />
            {collapsed ? null : (
              <>
                <span className={styles.accountCopy}>
                  <span className={styles.accountName}>{actor.name}</span>
                  <span className={styles.accountRole}>{role}</span>
                </span>
                <ChevronsUpDown
                  size={14}
                  strokeWidth={1.75}
                  className={styles.accountChevron}
                  aria-hidden
                />
              </>
            )}
          </button>
        )}
      >
        <PopoverMenuItem
          icon={<User size={15} strokeWidth={1.75} />}
          onClick={() => {
            setOpen(false);
            onNavigate?.();
            router.push("/settings");
          }}
        >
          Profile
        </PopoverMenuItem>
        <div className={styles.menuSeparator} role="separator" />
        <div className={styles.menuLabel} role="presentation">
          Theme
        </div>
        {THEME_OPTIONS.map(({ value, label, Icon }) => {
          const checked = preference === value;
          return (
            <button
              key={value}
              type="button"
              role="menuitemradio"
              aria-checked={checked}
              tabIndex={-1}
              className={styles.menuRadio}
              onClick={() => chooseTheme(value)}
            >
              <Icon
                size={15}
                strokeWidth={1.75}
                className={styles.menuRadioIcon}
                aria-hidden
              />
              <span className={styles.menuRadioLabel}>{label}</span>
              {checked ? <Check size={14} strokeWidth={2} aria-hidden /> : null}
            </button>
          );
        })}
      </Popover>
    </div>
  );
}
