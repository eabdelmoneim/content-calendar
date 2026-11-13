"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import {
  useWorkspaceAccess,
  useWorkspaceActor,
} from "@/shared/auth/workspace-access";
import { cx } from "@/shared/peacock/ui";
import styles from "./shell.module.css";

type WorkspaceMarkInput = { name: string; companySlug?: string };

/** Brand tile: client logos where we have them, else the indigo initial. */
export function WorkspaceMark({
  workspace,
  size = "md",
}: {
  workspace: WorkspaceMarkInput;
  size?: "sm" | "md";
}): React.JSX.Element {
  const brand =
    workspace.companySlug === "launchpoint"
      ? styles.markLaunchPoint
      : workspace.name === "Nebula.gg" || workspace.name === "Agent Labs"
        ? styles.markNebula
        : undefined;
  return (
    <span
      className={cx(styles.mark, size === "sm" && styles.markSm, brand)}
      aria-hidden
    >
      {brand ? null : (workspace.name.trim().charAt(0).toUpperCase() || "P")}
    </span>
  );
}

/**
 * Sidebar workspace selector (COMPONENTS.md › Sidebar): a button that opens a
 * listbox of the workspaces the session lists. The choice is persisted by
 * `selectWorkspace` (localStorage + users.preferences.lastOrgId).
 */
export function WorkspaceSwitcher({
  collapsed,
}: {
  collapsed: boolean;
}): React.JSX.Element {
  const actor = useWorkspaceActor();
  const access = useWorkspaceAccess();
  const workspaces = access?.workspaces ?? [];
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const current: WorkspaceMarkInput = {
    name: actor.organizationName,
  };

  useEffect(() => {
    if (!open) return;
    listRef.current?.focus();
    function onPointerDown(event: MouseEvent): void {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  function openList(): void {
    const index = workspaces.findIndex((w) => w.orgId === actor.orgId);
    setActiveIndex(Math.max(0, index));
    setOpen(true);
  }

  function close(returnFocus: boolean): void {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }

  function choose(index: number): void {
    const workspace = workspaces[index];
    if (workspace && access && workspace.orgId !== actor.orgId) {
      access.selectWorkspace(workspace.orgId);
    }
    close(true);
  }

  function onListKeyDown(event: KeyboardEvent<HTMLUListElement>): void {
    const last = workspaces.length - 1;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (event.key === "Tab") {
      close(false);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(last, index + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(0, index - 1));
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(last);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(activeIndex);
    }
  }

  return (
    <div ref={rootRef} className={styles.workspaceRoot}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.workspaceButton}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`Switch workspace: ${actor.organizationName}`}
        title={collapsed ? actor.organizationName : undefined}
        disabled={!access}
        onClick={() => (open ? close(false) : openList())}
        onKeyDown={(event) => {
          if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
            event.preventDefault();
            openList();
          }
        }}
      >
        <WorkspaceMark workspace={current} />
        {collapsed ? null : (
          <>
            <span className={styles.workspaceCopy}>
              <span className={styles.workspaceMeta}>Workspace</span>
              <span className={styles.workspaceName}>
                {actor.organizationName}
              </span>
            </span>
            <ChevronsUpDown
              size={14}
              strokeWidth={1.75}
              className={styles.workspaceChevron}
              aria-hidden
            />
          </>
        )}
      </button>
      {open ? (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label="Workspaces"
          tabIndex={-1}
          className={styles.workspaceList}
          aria-activedescendant={
            workspaces[activeIndex]
              ? `${listId}-${workspaces[activeIndex].orgId}`
              : undefined
          }
          onKeyDown={onListKeyDown}
        >
          {workspaces.map((workspace, index) => {
            const selected = workspace.orgId === actor.orgId;
            return (
              <li
                key={workspace.orgId}
                id={`${listId}-${workspace.orgId}`}
                role="option"
                aria-selected={selected}
                className={cx(
                  styles.workspaceOption,
                  index === activeIndex && styles.workspaceOptionActive,
                )}
                onMouseMove={() => setActiveIndex(index)}
                onClick={() => choose(index)}
              >
                <WorkspaceMark workspace={workspace} size="sm" />
                <span className={styles.workspaceOptionName}>
                  {workspace.name}
                </span>
                {selected ? (
                  <Check size={14} strokeWidth={2} aria-hidden />
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
