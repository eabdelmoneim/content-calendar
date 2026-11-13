"use client";

import { Ban, X } from "lucide-react";
import type { KeyboardEvent, ReactNode } from "react";
import { useId, useRef, useState } from "react";
import { cx } from "./cx";
import { Field, fieldIds } from "./field";
import styles from "./token-input.module.css";

export type TokenTone = "neutral" | "danger";

export type TokenInputProps = {
  /** Controlled list of tokens, in display order. */
  value: string[];
  onChange: (next: string[]) => void;
  /** Visible label above the box. Otherwise pass `aria-label`. */
  label?: ReactNode;
  "aria-label"?: string;
  hint?: ReactNode;
  error?: ReactNode;
  placeholder?: string;
  /** Tone for every token. `danger` adds a ban icon (exclusions). */
  tone?: TokenTone;
  /** Per-token tone; wins over `tone`. */
  toneFor?: (token: string) => TokenTone;
  /**
   * Cleans the typed text before it is added; return null to reject it.
   * Defaults to trimming. Duplicates (case-insensitive) are never added.
   */
  normalize?: (raw: string) => string | null;
  /** Stop accepting input once this many tokens exist. */
  maxTokens?: number;
  /** Per-token character limit for the text box. */
  maxLength?: number;
  disabled?: boolean;
  id?: string;
  className?: string;
};

/**
 * Free-text tag input (ICP keywords, exclusions). Enter adds the typed text
 * as a token; Backspace in an empty box removes the last token.
 */
export function TokenInput({
  value,
  onChange,
  label,
  "aria-label": ariaLabel,
  hint,
  error,
  placeholder,
  tone = "neutral",
  toneFor,
  normalize = (raw) => raw.trim() || null,
  maxTokens,
  maxLength,
  disabled = false,
  id,
  className,
}: TokenInputProps): React.JSX.Element {
  const autoId = useId();
  const inputId = id ?? autoId;
  const ids = fieldIds(inputId, hint, error);
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");
  const full = maxTokens !== undefined && value.length >= maxTokens;

  function add(): boolean {
    const next = normalize(draft);
    if (next === null || full) return false;
    const exists = value.some(
      (token) => token.toLowerCase() === next.toLowerCase(),
    );
    if (!exists) onChange([...value, next]);
    setDraft("");
    return true;
  }

  function remove(index: number): void {
    onChange(value.filter((_, i) => i !== index));
    inputRef.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Enter") {
      // Never submit the surrounding form from here.
      event.preventDefault();
      add();
    } else if (
      event.key === "Backspace" &&
      draft === "" &&
      value.length > 0 &&
      event.currentTarget.selectionStart === 0
    ) {
      event.preventDefault();
      onChange(value.slice(0, -1));
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
      <div
        className={cx(
          styles.box,
          error ? styles.invalid : undefined,
          disabled && styles.disabled,
        )}
        // Clicking the empty part of the box focuses the text field.
        onClick={(event) => {
          if (event.target === event.currentTarget) inputRef.current?.focus();
        }}
      >
        {value.length > 0 ? (
          <ul className={styles.tokens}>
            {value.map((token, index) => {
              const t = toneFor?.(token) ?? tone;
              return (
                <li
                  key={`${token}-${index}`}
                  className={cx(styles.token, t === "danger" && styles.danger)}
                >
                  {t === "danger" ? (
                    <Ban size={12} strokeWidth={2} aria-hidden />
                  ) : null}
                  <span className={styles.tokenText}>{token}</span>
                  <button
                    type="button"
                    className={styles.remove}
                    aria-label={`Remove ${token}`}
                    disabled={disabled}
                    onClick={() => remove(index)}
                  >
                    <X size={12} strokeWidth={2} aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
        <input
          ref={inputRef}
          id={inputId}
          className={styles.input}
          value={draft}
          placeholder={full ? undefined : placeholder}
          aria-label={label ? undefined : ariaLabel}
          aria-invalid={error ? true : undefined}
          aria-describedby={ids.describedBy}
          maxLength={maxLength}
          disabled={disabled}
          enterKeyHint="done"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
        />
      </div>
    </Field>
  );
}
