"use client";

import { UserRound } from "lucide-react";
import { useState, type KeyboardEvent } from "react";

import { Avatar, AvatarGroup, Checkbox, cx, ICON_STROKE, Input, Popover } from "@/shared/peacock/ui";
import { MAX_ASSIGNEES } from "@/lib/types";

import styles from "./todo.module.css";

/** "Eiman Abdelmoneim, Nathan Pang", or null when nobody is on it. */
export function assigneeLabel(names: readonly string[]): string | null {
  return names.length > 0 ? names.join(", ") : null;
}

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export type AssigneePickerProps = {
  /** The people currently on the to-do, in display order. */
  value: string[];
  /** Names to offer, in order (the viewer first, then the team). */
  options: readonly string[];
  /** Called with the next list every time a box is ticked or a name is added. */
  onChange: (names: string[]) => void;
  /** Accessible name of the trigger, e.g. `Assign to` or `Assign "Teaser" to`. */
  label: string;
  placeholder?: string;
  /** `field` sits in the add row; `chip` is the small pill on a to-do. */
  variant: "field" | "chip";
  /** Extra class on the trigger, e.g. to set its width. */
  className?: string;
};

/**
 * "Assign to" as a multi-select: the same dropdown of people, but each person
 * is a box to tick, so a to-do can be on several people at once. Typing still
 * filters the list and can add someone who isn't on it yet, like the old
 * free-text field did.
 */
export function AssigneePicker({
  value,
  options,
  onChange,
  label,
  placeholder = "Assign to",
  variant,
  className,
}: AssigneePickerProps): React.JSX.Element {
  const [query, setQuery] = useState("");

  const typed = query.trim().replace(/\s+/g, " ");
  const matches = typed.length === 0
    ? options
    : options.filter((name) => name.toLowerCase().includes(typed.toLowerCase()));
  const alreadyOn = value.some((name) => sameName(name, typed));
  const canAddTyped = typed.length > 0 && !alreadyOn && !options.some((name) => sameName(name, typed));
  const full = value.length >= MAX_ASSIGNEES;
  const hasRoom = !full || canAddTyped ? !full : false;

  function toggle(name: string): void {
    if (value.some((existing) => sameName(existing, name))) {
      onChange(value.filter((existing) => !sameName(existing, name)));
      return;
    }
    if (value.length >= MAX_ASSIGNEES) return;
    onChange([...value, name]);
  }

  function addTyped(): void {
    if (!canAddTyped || value.length >= MAX_ASSIGNEES) return;
    onChange([...value, typed]);
    setQuery("");
  }

  function onQueryKey(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (canAddTyped) addTyped();
    else if (matches.length === 1) toggle(matches[0]);
  }

  const summary = value.length === 0 ? placeholder : value.length === 1 ? value[0] : `${value.length} people`;

  return (
    <Popover
      align="start"
      label={`${label}: tick one or more people`}
      onOpenChange={(open) => {
        if (!open) setQuery("");
      }}
      trigger={(props) => (
        <button
          {...props}
          type="button"
          className={cx(
            variant === "field" ? styles.assigneeField : styles.assigneeButton,
            value.length === 0 && (variant === "field" ? styles.assigneeFieldEmpty : styles.unassigned),
            className,
          )}
          aria-label={value.length > 0 ? `${label}: ${value.join(", ")}. Change` : label}
          title={value.length > 0 ? value.join(", ") : placeholder}
        >
          {value.length > 0 ? (
            variant === "field" ? (
              <AvatarGroup people={value.map((name) => ({ name }))} size={20} max={3} label={value.join(", ")} />
            ) : (
              <AvatarGroup people={value.map((name) => ({ name }))} size={20} max={2} label={value.join(", ")} />
            )
          ) : (
            <UserRound size={14} strokeWidth={ICON_STROKE} aria-hidden />
          )}
          <span className={cx(styles.assigneeName, variant === "field" && styles.assigneeFieldName)}>{summary}</span>
        </button>
      )}
    >
      <div className={styles.pickerPanel}>
        <Input
          autoFocus
          type="search"
          aria-label="Find a person"
          placeholder="Find a person"
          value={query}
          maxLength={120}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onQueryKey}
        />
        <ul className={styles.pickerList} aria-label={label}>
          {matches.map((name) => {
            const checked = value.some((existing) => sameName(existing, name));
            return (
              <li key={name}>
                <label className={cx(styles.pickerOption, !checked && full && styles.pickerOptionFull)}>
                  <Checkbox
                    checked={checked}
                    disabled={!checked && full}
                    onCheckedChange={() => toggle(name)}
                    aria-label={name}
                  />
                  <Avatar name={name} size={20} decorative />
                  <span className={styles.pickerOptionName}>{name}</span>
                </label>
              </li>
            );
          })}
          {canAddTyped ? (
            <li>
              <button
                type="button"
                className={styles.pickerAdd}
                disabled={full}
                onClick={addTyped}
              >
                <UserRound size={13} strokeWidth={ICON_STROKE} aria-hidden />
                Assign to “{typed}”
              </button>
            </li>
          ) : null}
          {matches.length === 0 && !canAddTyped ? <li className={styles.pickerEmpty}>No one by that name.</li> : null}
        </ul>
        <div className={styles.pickerFoot}>
          <span className={styles.pickerHint}>
            {full ? `Up to ${MAX_ASSIGNEES} people per to-do.` : "Tick everyone who is on it."}
          </span>
          {value.length > 0 ? (
            <button type="button" className={styles.pickerClear} onClick={() => onChange([])}>
              Clear
            </button>
          ) : null}
        </div>
      </div>
    </Popover>
  );
}
