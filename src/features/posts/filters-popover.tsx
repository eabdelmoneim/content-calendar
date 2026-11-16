"use client";

import { ListFilter } from "lucide-react";
import { Avatar, CHIP_STATUS_MAP, Checkbox, Popover, cx } from "@/shared/peacock/ui";
import { PLATFORMS } from "@/lib/types";
import { useProfileSelection } from "@/shared/shell/profile-selection";
import {
  EMPTY_FILTERS,
  FILTER_STATUSES,
  displaySpec,
  filterCount,
  toggleIn,
  type CalendarFilters,
} from "./calendar-model";
import { PlatformIcon, platformName } from "./platform-icon";
import styles from "./scheduler.module.css";

export type FiltersPopoverProps = {
  filters: CalendarFilters;
  onChange: (filters: CalendarFilters) => void;
  shown: number;
  total: number;
};

/**
 * Filters popover: Account, Status and Platform (Peacock SCREENS.md › Posts).
 * Account is the same selection as the top-bar account selector, so the two
 * always agree. Like the other sections, nothing ticked means everyone.
 */
export function FiltersPopover({ filters, onChange, shown, total }: FiltersPopoverProps): React.JSX.Element {
  const selection = useProfileSelection();
  const accountIds = selection.members.map((member) => member.memberId);
  const allAccounts = accountIds.every((id) => selection.isSelected(id));
  const accountCount = allAccounts ? 0 : selection.selectedProfileIds.length;
  const count = filterCount(filters) + accountCount;

  function toggleAccount(profileId: string): void {
    if (allAccounts) {
      selection.selectOnlyProfile?.(profileId);
    } else if (selection.selectedProfileIds.length === 1 && selection.isSelected(profileId)) {
      // Unticking the last one means "no account filter", i.e. everyone.
      selection.selectAllProfiles?.();
    } else {
      selection.toggleProfile(profileId);
    }
  }
  return (
    <Popover
      label="Filters"
      align="end"
      className={styles.filtersPanel}
      trigger={(props) => (
        <button
          {...props}
          type="button"
          className={cx(styles.toolButton, count > 0 && styles.toolButtonActive)}
        >
          <ListFilter size={14} strokeWidth={1.75} aria-hidden />
          Filters
          {count > 0 ? (
            <span className={styles.filterCount}>
              {count}
              <span className="sr-only"> active</span>
            </span>
          ) : null}
        </button>
      )}
    >
      <div className={styles.filtersHeader}>
        <span className={styles.filtersTitle}>Filters</span>
        <button
          type="button"
          className={styles.textButton}
          disabled={count === 0}
          onClick={() => {
            onChange(EMPTY_FILTERS);
            selection.selectAllProfiles?.();
          }}
        >
          Clear all
        </button>
      </div>

      {selection.members.length > 1 ? (
        <section className={styles.filterSection} aria-label="Account">
          <div className={styles.filterSectionHead}>
            <span>Account</span>
            {accountCount > 0 ? (
              <button type="button" className={styles.textButton} onClick={() => selection.selectAllProfiles?.()}>
                Clear
              </button>
            ) : null}
          </div>
          <div className={styles.checkList}>
            {selection.members.map((member) => (
              <Checkbox
                key={member.memberId}
                className={styles.checkRow}
                checked={!allAccounts && selection.isSelected(member.memberId)}
                onCheckedChange={() => toggleAccount(member.memberId)}
                label={
                  <span className={styles.checkLabel}>
                    <Avatar name={member.name} src={member.profilePictureUrl} size={16} decorative />
                    <span className={styles.checkName}>{member.name}</span>
                  </span>
                }
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className={styles.filterSection} aria-label="Status">
        <div className={styles.filterSectionHead}>
          <span>Status</span>
          {filters.statuses.length > 0 ? (
            <button type="button" className={styles.textButton} onClick={() => onChange({ ...filters, statuses: [] })}>
              Clear
            </button>
          ) : null}
        </div>
        <div className={styles.checkList}>
          {FILTER_STATUSES.map((status) => {
            const display = displaySpec(status);
            const spec = CHIP_STATUS_MAP[display.chip];
            const Icon = spec.icon && typeof spec.icon !== "string" ? spec.icon : null;
            return (
              <Checkbox
                key={status}
                className={styles.checkRow}
                checked={filters.statuses.includes(status)}
                onCheckedChange={() => onChange({ ...filters, statuses: toggleIn(filters.statuses, status) })}
                label={
                  <span className={styles.checkLabel}>
                    {Icon ? (
                      <Icon
                        size={12}
                        strokeWidth={2}
                        aria-hidden
                        className={cx(styles.statusIcon, styles[`tone_${spec.tone}`])}
                      />
                    ) : null}
                    <span className={styles.checkName}>{display.label}</span>
                  </span>
                }
              />
            );
          })}
        </div>
      </section>

      <section className={styles.filterSection} aria-label="Platform">
        <div className={styles.filterSectionHead}>
          <span>Platform</span>
          {filters.platforms.length > 0 ? (
            <button type="button" className={styles.textButton} onClick={() => onChange({ ...filters, platforms: [] })}>
              Clear
            </button>
          ) : null}
        </div>
        <div className={styles.checkList}>
          {PLATFORMS.map((platform) => (
            <Checkbox
              key={platform}
              className={styles.checkRow}
              checked={filters.platforms.includes(platform)}
              onCheckedChange={() => onChange({ ...filters, platforms: toggleIn(filters.platforms, platform) })}
              label={
                <span className={styles.checkLabel}>
                  <PlatformIcon platform={platform} size={13} />
                  <span className={styles.checkName}>{platformName(platform)}</span>
                </span>
              }
            />
          ))}
        </div>
      </section>

      <p className={styles.filtersSummary} role="status">
        Showing {shown} of {total} posts
      </p>
    </Popover>
  );
}
