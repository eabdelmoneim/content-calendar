import type { KeyboardEvent } from "react";

type Item = { value: string; disabled?: boolean };

/**
 * Arrow/Home/End handling for single-select groups (tabs, radiogroups).
 * Selection follows focus. Returns the next value, or null when the key is
 * not handled. Disabled items are skipped.
 */
export function nextRovingValue<T extends Item>(
  event: KeyboardEvent,
  items: T[],
  current: string,
  orientation: "horizontal" | "vertical" | "both" = "both",
): string | null {
  const enabled = items.filter((item) => !item.disabled);
  if (enabled.length === 0) return null;
  const index = Math.max(
    enabled.findIndex((item) => item.value === current),
    0,
  );
  const prevKeys =
    orientation === "horizontal"
      ? ["ArrowLeft"]
      : orientation === "vertical"
        ? ["ArrowUp"]
        : ["ArrowLeft", "ArrowUp"];
  const nextKeys =
    orientation === "horizontal"
      ? ["ArrowRight"]
      : orientation === "vertical"
        ? ["ArrowDown"]
        : ["ArrowRight", "ArrowDown"];

  let target: number;
  if (nextKeys.includes(event.key)) target = (index + 1) % enabled.length;
  else if (prevKeys.includes(event.key))
    target = (index - 1 + enabled.length) % enabled.length;
  else if (event.key === "Home") target = 0;
  else if (event.key === "End") target = enabled.length - 1;
  else return null;

  event.preventDefault();
  return enabled[target].value;
}

/** Moves DOM focus to the element in `container` carrying data-value. */
export function focusValue(container: HTMLElement | null, value: string): void {
  if (!container) return;
  const el = Array.from(
    container.querySelectorAll<HTMLElement>("[data-value]"),
  ).find((node) => node.dataset.value === value);
  el?.focus();
}
