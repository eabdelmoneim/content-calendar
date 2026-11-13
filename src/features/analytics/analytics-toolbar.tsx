"use client";

import { Calendar, Check, ChevronDown } from "lucide-react";
import { useState, type FormEvent } from "react";
import {
  Button,
  Input,
  Popover,
  PopoverMenuItem,
  Segmented,
  cx,
} from "@/shared/peacock/ui";
import {
  DATE_PRESETS,
  MAX_RANGE_DAYS,
  rangeLabel,
  validRange,
  type DatePreset,
  type PlatformFilter,
} from "./analytics-model";
import { LinkedInMark, PlatformMark, XMark } from "./brand-icons";
import styles from "./analytics.module.css";

export type RangeChoice =
  { preset: DatePreset } | { start: string; end: string };

export const PLATFORM_LABEL: Record<PlatformFilter, string> = {
  all: "All platforms",
  linkedin: "LinkedIn",
  x: "X",
};

export function presetLabel(choice: RangeChoice): string {
  return "preset" in choice ? `Last ${choice.preset} days` : "Custom range";
}

export function PlatformSegmented({
  value,
  onChange,
}: {
  value: PlatformFilter;
  onChange: (value: PlatformFilter) => void;
}): React.JSX.Element {
  return (
    <Segmented
      label="Platform"
      size="compact"
      value={value}
      onChange={onChange}
      options={[
        { value: "all", label: "All platforms" },
        {
          value: "linkedin",
          ariaLabel: "LinkedIn",
          label: (
            <>
              <LinkedInMark size={12} />
              LinkedIn
            </>
          ),
        },
        {
          value: "x",
          ariaLabel: "X",
          label: (
            <>
              <XMark size={12} />X
            </>
          ),
        },
      ]}
    />
  );
}

/** Joined date-range group: custom dates | preset menu. UTC days. */
export function DateRangeControl({
  today,
  choice,
  dates,
  onChange,
  presetOpen,
  onPresetOpenChange,
  variant = "group",
}: {
  today: string;
  choice: RangeChoice;
  dates: { start: string; end: string } | null;
  onChange: (choice: RangeChoice) => void;
  presetOpen: boolean;
  onPresetOpenChange: (open: boolean) => void;
  variant?: "group" | "chip";
}): React.JSX.Element {
  const [customOpen, setCustomOpen] = useState(false);
  const [draft, setDraft] = useState<{ start: string; end: string } | null>(
    null,
  );
  const [error, setError] = useState("");
  const values = draft ?? dates ?? { start: "", end: "" };

  function openCustom(): void {
    setDraft(null);
    setError("");
    onPresetOpenChange(false);
    setCustomOpen(true);
  }

  function apply(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!validRange(values.start, values.end) || values.end > today) {
      setError(`Choose up to ${MAX_RANGE_DAYS} days, ending today or earlier.`);
      return;
    }
    onChange({ start: values.start, end: values.end });
    setCustomOpen(false);
  }

  const form = (
    <form className={styles.dateForm} onSubmit={apply} noValidate>
      <p className={styles.panelHint}>Reporting dates are in UTC.</p>
      <Input
        type="date"
        label="Start date"
        value={values.start}
        max={today}
        required
        onChange={(event) => setDraft({ ...values, start: event.target.value })}
      />
      <Input
        type="date"
        label="End date"
        value={values.end}
        min={values.start}
        max={today}
        required
        error={error || undefined}
        onChange={(event) => setDraft({ ...values, end: event.target.value })}
      />
      <div className={styles.dateActions}>
        <Button size="sm" variant="primary" type="submit">
          Apply dates
        </Button>
      </div>
    </form>
  );

  if (variant === "chip")
    // Mobile: one chip opens presets and custom dates together.
    return (
      <Popover
        label="Date range"
        open={presetOpen}
        onOpenChange={(open) => {
          if (open) {
            setDraft(null);
            setError("");
          }
          onPresetOpenChange(open);
        }}
        className={styles.datePanel}
        trigger={(props) => (
          <button type="button" {...props} className={styles.chip}>
            <Calendar size={14} className={styles.chevron} aria-hidden />
            {presetLabel(choice)}
            <ChevronDown size={14} className={styles.chevron} aria-hidden />
          </button>
        )}
      >
        <div className={styles.presetList}>
          {DATE_PRESETS.map((days) => {
            const on = "preset" in choice && choice.preset === days;
            return (
              <button
                key={days}
                type="button"
                aria-pressed={on}
                className={styles.presetOption}
                onClick={() => {
                  onChange({ preset: days });
                  onPresetOpenChange(false);
                }}
              >
                Last {days} days
                {on ? <Check size={14} aria-hidden /> : null}
              </button>
            );
          })}
        </div>
        {form}
      </Popover>
    );

  const presetMenu = (
    <Popover
      label="Date range presets"
      role="menu"
      align="end"
      open={presetOpen}
      onOpenChange={onPresetOpenChange}
      trigger={(props) => (
        <button type="button" {...props} className={styles.dateButton}>
          {presetLabel(choice)}
          <ChevronDown size={14} className={styles.chevron} aria-hidden />
        </button>
      )}
    >
      {DATE_PRESETS.map((days) => {
        const on = "preset" in choice && choice.preset === days;
        return (
          <PopoverMenuItem
            key={days}
            role="menuitemradio"
            aria-checked={on}
            icon={on ? <Check size={14} /> : <span />}
            onClick={() => {
              onChange({ preset: days });
              onPresetOpenChange(false);
            }}
          >
            Last {days} days
          </PopoverMenuItem>
        );
      })}
      <PopoverMenuItem
        role="menuitemradio"
        aria-checked={!("preset" in choice)}
        icon={!("preset" in choice) ? <Check size={14} /> : <span />}
        onClick={openCustom}
      >
        Custom range…
      </PopoverMenuItem>
    </Popover>
  );

  const customPanel = (
    <Popover
      label="Custom date range"
      align="end"
      open={customOpen}
      onOpenChange={setCustomOpen}
      className={styles.datePanel}
      trigger={(props) => (
        <button
          type="button"
          {...props}
          className={cx(styles.dateButton, styles.dateRangeButton)}
          aria-label={
            dates
              ? `Date range ${rangeLabel(dates.start, dates.end)}. Choose custom dates`
              : "Choose custom dates"
          }
          onClick={() => {
            if (!customOpen) {
              setDraft(null);
              setError("");
            }
            props.onClick();
          }}
        >
          <Calendar size={14} className={styles.chevron} aria-hidden />
          {dates ? rangeLabel(dates.start, dates.end) : "Select dates"}
        </button>
      )}
    >
      {form}
    </Popover>
  );

  return (
    <div className={styles.dateGroup} role="group" aria-label="Date range">
      {customPanel}
      {presetMenu}
    </div>
  );
}

export function PlatformMenu({
  value,
  onChange,
}: {
  value: PlatformFilter;
  onChange: (value: PlatformFilter) => void;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <Popover
      label="Platform"
      role="menu"
      open={open}
      onOpenChange={setOpen}
      trigger={(props) => (
        <button type="button" {...props} className={styles.chip}>
          {PLATFORM_LABEL[value]}
          <ChevronDown size={14} className={styles.chevron} aria-hidden />
        </button>
      )}
    >
      {(["all", "linkedin", "x"] as const).map((option) => (
        <PopoverMenuItem
          key={option}
          role="menuitemradio"
          aria-checked={value === option}
          icon={
            option === "all" ? (
              value === option ? (
                <Check size={14} />
              ) : (
                <span />
              )
            ) : (
              <PlatformMark platform={option} size={13} />
            )
          }
          onClick={() => {
            onChange(option);
            setOpen(false);
          }}
        >
          {PLATFORM_LABEL[option]}
        </PopoverMenuItem>
      ))}
    </Popover>
  );
}
