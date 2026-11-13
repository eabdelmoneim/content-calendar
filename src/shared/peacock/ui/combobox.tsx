"use client";

import { Check } from "lucide-react";
import type { KeyboardEvent, ReactNode } from "react";
import { useId, useMemo, useRef, useState } from "react";
import control from "./control.module.css";
import styles from "./combobox.module.css";
import { cx, ICON_STROKE } from "./cx";
import { Field, fieldIds } from "./field";

export type ComboboxOption = {
  value: string;
  label: string;
  /** e.g. an Avatar. */
  leading?: ReactNode;
  /** e.g. a platform icon. */
  trailing?: ReactNode;
};

export type ComboboxProps = {
  options: ComboboxOption[];
  value: string | null;
  onChange: (value: string) => void;
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  placeholder?: string;
  /** Shown when nothing matches. */
  emptyText?: string;
  id?: string;
  className?: string;
};

/** Splits `label` around the first case-insensitive match of `query`. */
export function highlightMatch(label: string, query: string): ReactNode {
  const q = query.trim();
  if (!q) return label;
  const index = label.toLowerCase().indexOf(q.toLowerCase());
  if (index < 0) return label;
  return (
    <>
      {label.slice(0, index)}
      <b className={styles.match}>{label.slice(index, index + q.length)}</b>
      {label.slice(index + q.length)}
    </>
  );
}

/**
 * Filterable single-select (author picker). ARIA 1.2 combobox: the input owns
 * focus and points at the active option with aria-activedescendant.
 */
export function Combobox({
  options,
  value,
  onChange,
  label,
  hint,
  error,
  placeholder,
  emptyText = "No matches",
  id,
  className,
}: ComboboxProps): React.JSX.Element {
  const autoId = useId();
  const inputId = id ?? autoId;
  const listId = `${inputId}-listbox`;
  const ids = fieldIds(inputId, hint, error);
  const selected = options.find((option) => option.value === value) ?? null;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const text = query ?? selected?.label ?? "";
  const filtered = useMemo(() => {
    const q = (query ?? "").trim().toLowerCase();
    if (!q) return options;
    return options.filter((option) => option.label.toLowerCase().includes(q));
  }, [options, query]);
  const activeIndex = Math.min(active, Math.max(filtered.length - 1, 0));
  const activeOption = open ? filtered[activeIndex] : undefined;

  function commit(option: ComboboxOption): void {
    onChange(option.value);
    setQuery(null);
    setOpen(false);
  }

  function close(): void {
    setOpen(false);
    setQuery(null);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!open) {
          setOpen(true);
          setActive(0);
        } else {
          setActive((activeIndex + 1) % Math.max(filtered.length, 1));
        }
        break;
      case "ArrowUp":
        event.preventDefault();
        setOpen(true);
        setActive(
          (activeIndex - 1 + filtered.length) % Math.max(filtered.length, 1),
        );
        break;
      case "Enter":
        if (open && activeOption) {
          event.preventDefault();
          commit(activeOption);
        }
        break;
      case "Escape":
        if (open) {
          event.preventDefault();
          close();
        }
        break;
      default:
        break;
    }
  }

  return (
    <Field
      htmlFor={inputId}
      label={label}
      hint={hint}
      error={error}
      hintId={ids.hintId}
      errorId={ids.errorId}
      className={className}
    >
      <span className={styles.anchor}>
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          autoComplete="off"
          className={control.control}
          value={text}
          placeholder={placeholder}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            activeOption ? `${listId}-${activeOption.value}` : undefined
          }
          aria-invalid={error ? true : undefined}
          aria-describedby={ids.describedBy}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={close}
          onKeyDown={onKeyDown}
        />
        <ul
          id={listId}
          role="listbox"
          className={styles.list}
          hidden={!open}
          aria-label={typeof label === "string" ? label : undefined}
        >
          {filtered.length === 0 ? (
            <li className={styles.empty} role="presentation">
              {emptyText}
            </li>
          ) : (
            filtered.map((option, index) => {
              const isSelected = option.value === value;
              return (
                <li
                  key={option.value}
                  id={`${listId}-${option.value}`}
                  role="option"
                  aria-selected={isSelected}
                  className={cx(
                    styles.option,
                    index === activeIndex && styles.active,
                  )}
                  // Keep focus in the input while choosing with the pointer.
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => commit(option)}
                >
                  {option.leading ? (
                    <span className={styles.leading}>{option.leading}</span>
                  ) : null}
                  <span className={styles.label}>
                    {highlightMatch(option.label, query ?? "")}
                  </span>
                  {option.trailing ? (
                    <span className={styles.trailing}>{option.trailing}</span>
                  ) : null}
                  {isSelected ? (
                    <Check
                      className={styles.check}
                      size={14}
                      strokeWidth={ICON_STROKE}
                      aria-hidden
                    />
                  ) : null}
                </li>
              );
            })
          )}
        </ul>
      </span>
    </Field>
  );
}
