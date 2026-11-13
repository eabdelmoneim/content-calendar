"use client";

import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";

import { highlightMatch } from "@/shared/peacock/ui";
import { ModalSurface } from "@/shared/peacock/ui/modal";
import {
  matchesQuery,
  presentItems,
  useCommandSources,
  type CommandContext,
  type CommandItem,
  type CommandSource,
} from "./command-registry";
import {
  NEW_POST_HREF,
  navigationCommands,
} from "./command-navigation";
import styles from "./command-palette.module.css";

export { NEW_POST_HREF } from "./command-navigation";

const ICON = { size: 15, strokeWidth: 1.75 } as const;

const createSource: CommandSource = {
  id: "create",
  group: "Create",
  order: 10,
  useItems: (query) =>
    [
      {
        id: "new-post",
        label: "New post",
        icon: <Plus {...ICON} />,
        shortcut: ["C"],
        keywords: ["create", "compose", "draft"],
        href: NEW_POST_HREF,
      } satisfies CommandItem,
    ].filter((item) => matchesQuery(item, query)),
};

const navigationSource: CommandSource = {
  id: "navigation",
  group: "Go to",
  order: 20,
  useItems: (query, context) =>
    navigationCommands(context.isGlobalAdmin)
      .map(({ Icon, ...command }): CommandItem => ({
        ...command,
        icon: <Icon {...ICON} />,
      }))
      .filter((item) => matchesQuery(item, query)),
};

export const BUILT_IN_COMMAND_SOURCES: readonly CommandSource[] = [
  createSource,
  navigationSource,
];

export type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isGlobalAdmin: boolean;
};

/**
 * ⌘K / Ctrl K palette (COMPONENTS.md › CommandPalette). Keyboard-only
 * trigger for now (AGENTS.md › Known open items). Arrow keys move, Enter
 * opens, Esc closes. Never offers Publish or Send.
 */
export function CommandPalette({
  open,
  onOpenChange,
  isGlobalAdmin,
}: CommandPaletteProps): React.JSX.Element | null {
  if (!open) return null;
  return (
    <PaletteSurface
      onClose={() => onOpenChange(false)}
      isGlobalAdmin={isGlobalAdmin}
    />
  );
}

function PaletteSurface({
  onClose,
  isGlobalAdmin,
}: {
  onClose: () => void;
  isGlobalAdmin: boolean;
}): React.JSX.Element {
  const router = useRouter();
  const registered = useCommandSources();
  const sources = [
    ...BUILT_IN_COMMAND_SOURCES,
    ...registered.filter(
      (source) =>
        !BUILT_IN_COMMAND_SOURCES.some((builtIn) => builtIn.id === source.id),
    ),
  ].sort((left, right) => (left.order ?? 50) - (right.order ?? 50));
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const baseId = useId();
  const listId = `${baseId}-list`;
  const context: CommandContext = { isGlobalAdmin };

  function options(): HTMLElement[] {
    return Array.from(
      listRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [],
    );
  }

  // Keep the active option valid as results change (first option by default).
  // Options come from source hooks rendered below (some load asynchronously),
  // so the rendered DOM is the only complete list: this measures it after
  // every commit and settles in one extra render at most.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const all = options();
    if (all.some((option) => option.id === activeId)) return;
    const next = all[0]?.id ?? null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (next !== activeId) setActiveId(next);
  });

  function activate(item: CommandItem): void {
    onClose();
    if (item.href) router.push(item.href);
    else item.run?.();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    const all = options();
    if (all.length === 0) return;
    const index = all.findIndex((option) => option.id === activeId);
    let next = -1;
    if (event.key === "ArrowDown") next = (index + 1) % all.length;
    else if (event.key === "ArrowUp")
      next = (index - 1 + all.length) % all.length;
    else if (event.key === "Home" && event.ctrlKey) next = 0;
    else if (event.key === "End" && event.ctrlKey) next = all.length - 1;
    else if (event.key === "Enter") {
      event.preventDefault();
      (all[index] ?? all[0])?.click();
      return;
    }
    if (next < 0) return;
    event.preventDefault();
    setActiveId(all[next].id);
    all[next].scrollIntoView?.({ block: "nearest" });
  }

  return (
    <ModalSurface
      onClose={onClose}
      label="Command palette"
      initialFocusRef={inputRef}
      layoutClassName={styles.layout}
      panelClassName={styles.panel}
    >
      <div className={styles.searchRow}>
        <Search
          size={16}
          strokeWidth={1.75}
          className={styles.searchIcon}
          aria-hidden
        />
        <input
          ref={inputRef}
          className={styles.input}
          type="text"
          role="combobox"
          aria-label="Search commands"
          aria-expanded="true"
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId ?? undefined}
          placeholder="Search or jump to…"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            // New results start from the top match.
            setActiveId(null);
          }}
          onKeyDown={onKeyDown}
        />
        <kbd className={styles.esc}>esc</kbd>
      </div>
      <div
        ref={listRef}
        id={listId}
        role="listbox"
        aria-label="Commands"
        className={styles.list}
      >
        {sources.map((source) => (
          <SourceGroup
            key={source.id}
            source={source}
            query={query}
            context={context}
            baseId={baseId}
            activeId={activeId}
            onHover={setActiveId}
            onActivate={activate}
          />
        ))}
      </div>
      <p className={styles.empty} role="status">
        No matches
      </p>
    </ModalSurface>
  );
}

function SourceGroup({
  source,
  query,
  context,
  baseId,
  activeId,
  onHover,
  onActivate,
}: {
  source: CommandSource;
  query: string;
  context: CommandContext;
  baseId: string;
  activeId: string | null;
  onHover: (id: string) => void;
  onActivate: (item: CommandItem) => void;
}): React.JSX.Element | null {
  const items = presentItems(source.useItems(query, context));
  const headingId = `${baseId}-${source.id}-heading`;
  if (items.length === 0) return null;
  return (
    <div role="group" aria-labelledby={headingId} className={styles.group}>
      <div id={headingId} className={styles.groupLabel} role="presentation">
        {source.group}
      </div>
      {items.map((item) => {
        const optionId = `${baseId}-${source.id}-${item.id}`;
        const active = optionId === activeId;
        return (
          <div
            key={item.id}
            id={optionId}
            role="option"
            aria-selected={active}
            className={styles.option}
            onMouseMove={() => {
              if (!active) onHover(optionId);
            }}
            onClick={() => onActivate(item)}
          >
            {item.icon ? (
              <span className={styles.optionIcon} aria-hidden>
                {item.icon}
              </span>
            ) : null}
            <span className={styles.optionLabel}>
              {highlightMatch(item.label, query)}
            </span>
            {item.shortcut ? (
              <span className={styles.shortcut} aria-hidden>
                {item.shortcut.join(" ")}
              </span>
            ) : active ? (
              <span className={styles.shortcut} aria-hidden>
                ↵
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
