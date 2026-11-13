"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";

/**
 * Pluggable ⌘K result sources. Built-in sources cover navigation and create
 * actions; posts, people, leads and assets search register with
 * `useRegisterCommandSource` once for every (app) route
 * (app/(app)/global-command-sources.tsx), so ⌘K searches them from any screen.
 *
 * The palette never runs anything outbound. Items whose label names Publish
 * or Send are dropped here, whatever source returns them, so those actions
 * stay behind their own review screens (AGENTS.md › Non-negotiable rules).
 */

export type CommandItem = {
  /** Unique within its source. */
  id: string;
  label: string;
  icon?: ReactNode;
  /** Shortcut hint shown on the right, e.g. ["C"] or ["G", "then", "M"]. */
  shortcut?: readonly string[];
  /** Extra text matched by the query but not shown. */
  keywords?: readonly string[];
  /** Navigation target; the palette routes there and closes. */
  href?: string;
  /** Non-navigation action; must not publish, send or call a provider. */
  run?: () => void;
};

export type CommandContext = {
  isGlobalAdmin: boolean;
};

export type CommandSource = {
  id: string;
  /** Group heading, e.g. "Posts", "Go to". */
  group: string;
  /** Lower sorts first. Built-ins: create 10, navigation 20. */
  order?: number;
  /**
   * Hook returning the items for the current query. It runs as a hook inside
   * its own component while the palette is open, so it may call Convex
   * `useQuery` (saved data only; never a provider read). Return every match;
   * the palette filters outbound labels and caps each group at 8.
   */
  useItems: (query: string, context: CommandContext) => readonly CommandItem[];
};

export const MAX_ITEMS_PER_GROUP = 8;

const OUTBOUND_LABEL = /\b(publish|send)\b/i;

/** True when an item would read as an outbound action. */
export function isOutboundCommand(item: Pick<CommandItem, "label">): boolean {
  return OUTBOUND_LABEL.test(item.label);
}

/** Case-insensitive substring match over the label and keywords. */
export function matchesQuery(item: CommandItem, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [item.label, ...(item.keywords ?? [])].some((text) =>
    text.toLowerCase().includes(needle),
  );
}

/** Drops outbound items and applies the per-group cap. */
export function presentItems(
  items: readonly CommandItem[],
): readonly CommandItem[] {
  return items
    .filter((item) => !isOutboundCommand(item))
    .slice(0, MAX_ITEMS_PER_GROUP);
}

let sources: readonly CommandSource[] = [];
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** Registers a source; returns its unregister function. Same id replaces. */
export function registerCommandSource(source: CommandSource): () => void {
  sources = [...sources.filter((entry) => entry.id !== source.id), source];
  emit();
  return () => {
    if (!sources.includes(source)) return;
    sources = sources.filter((entry) => entry !== source);
    emit();
  };
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): readonly CommandSource[] {
  return sources;
}

const EMPTY: readonly CommandSource[] = [];

export function useCommandSources(): readonly CommandSource[] {
  const registered = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
  return [...registered].sort(
    (left, right) => (left.order ?? 50) - (right.order ?? 50),
  );
}

/** Registers a source for as long as the calling component is mounted. */
export function useRegisterCommandSource(source: CommandSource): void {
  useEffect(() => registerCommandSource(source), [source]);
}
