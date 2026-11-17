import type { AssetTodo } from "@/lib/types";

export type TodoFilter = "all" | "not_started" | "in_progress" | "done";

export type TodoState = "not_started" | "in_progress" | "done";

/** Done wins; otherwise in progress once someone has started it. */
export function todoState(todo: AssetTodo): TodoState {
  if (todo.completedAt !== null) return "done";
  return todo.startedAt !== null ? "in_progress" : "not_started";
}

/** The device's calendar day as YYYY-MM-DD. */
export function localDayKey(date: Date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Open items first, soonest due date first (no date last, then oldest added);
 * finished items after them, most recently finished first.
 */
export function sortTodos(todos: readonly AssetTodo[]): AssetTodo[] {
  return [...todos].sort((a, b) => {
    const aDone = a.completedAt !== null;
    const bDone = b.completedAt !== null;
    if (aDone !== bDone) return aDone ? 1 : -1;
    if (aDone && bDone) return (b.completedAt ?? "").localeCompare(a.completedAt ?? "");
    if (a.dueOn !== b.dueOn) {
      if (a.dueOn === null) return 1;
      if (b.dueOn === null) return -1;
      return a.dueOn.localeCompare(b.dueOn);
    }
    return a.createdAt.localeCompare(b.createdAt);
  });
}

export function filterTodos(todos: readonly AssetTodo[], filter: TodoFilter): AssetTodo[] {
  if (filter === "all") return [...todos];
  return todos.filter((todo) => todoState(todo) === filter);
}

export type DueState = "none" | "overdue" | "today" | "upcoming";

export function dueState(todo: AssetTodo, today: string | null): DueState {
  if (todo.dueOn === null || today === null || todo.completedAt !== null) return "none";
  if (todo.dueOn < today) return "overdue";
  if (todo.dueOn === today) return "today";
  return "upcoming";
}

/** "Fri 20 Nov", with the year only when it isn't this year. */
export function formatDueDay(dueOn: string, today: string | null): string {
  const [year, month, day] = dueOn.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const sameYear = today !== null && today.slice(0, 4) === dueOn.slice(0, 4);
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/** "everyone", "unassigned", or a person's name. */
export type AssigneeFilter = string;
export const EVERYONE = "\u0000everyone";
export const UNASSIGNED = "\u0000unassigned";

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Names to offer when assigning: the viewer, everyone already on the list
 * (assigned, added or ticked it), then people accounts from Settings whose
 * first name doesn't already appear. Free text still works for anyone else.
 */
export function assigneeSuggestions(
  todos: readonly AssetTodo[],
  viewerName: string | null,
  personAccounts: readonly string[],
): string[] {
  const names: string[] = [];
  const add = (name: string | null | undefined) => {
    const clean = name?.trim();
    if (clean && !names.some((existing) => sameName(existing, clean))) names.push(clean);
  };
  add(viewerName);
  for (const todo of todos) {
    add(todo.assigneeName);
    add(todo.createdByName);
    add(todo.completedByName);
    add(todo.startedByName);
  }
  const firstNames = names.map((name) => name.split(" ")[0].toLowerCase());
  for (const account of personAccounts) {
    if (!firstNames.includes(account.split(" ")[0].toLowerCase())) add(account);
  }
  const [viewer, ...rest] = names;
  return viewerName ? [viewer, ...rest.sort((a, b) => a.localeCompare(b))] : names.sort((a, b) => a.localeCompare(b));
}

export function filterByAssignee(todos: readonly AssetTodo[], filter: AssigneeFilter): AssetTodo[] {
  if (filter === EVERYONE) return [...todos];
  if (filter === UNASSIGNED) return todos.filter((todo) => todo.assigneeName === null);
  return todos.filter((todo) => todo.assigneeName !== null && sameName(todo.assigneeName, filter));
}
